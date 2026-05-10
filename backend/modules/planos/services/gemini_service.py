import json
import ast
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from django.conf import settings


@dataclass
class GeminiParseResult:
    vector_data: List[Dict[str, Any]]
    raw_text: str


class GeminiServiceError(Exception):
    """Errores controlados del servicio Gemini (para devolver 4xx al frontend)."""


SYSTEM_PROMPT = (
    "Eres un sistema experto en detección de planos arquitectónicos 2D. DEBES digitalizar esta imagen completa. "
    "REGLA ABSOLUTA: Los MUROS (paredes) son lo más importante. Sin muros, la respuesta es inválida. "
    "Trabaja con coordenadas en píxeles reales de la imagen (0 a ~600 ancho, 0 a ~500 alto). "
    "Tipos permitidos: 'muro', 'puerta', 'ventana', 'texto', 'simbolo', 'cota'. "
    "PROCESO OBLIGATORIO EN ORDEN:\n"
    "[1] MUROS PERIMETRALES: Dibuja los 4 muros del borde exterior como rectángulos finos (height=8 para horizontales, width=8 para verticales). "
    "[2] MUROS INTERIORES: Encuentra CADA línea que separa habitaciones. Son líneas paralelas dobles o simples. Añade un muro por cada división. "
    "[3] PUERTAS: Busca arcos en los muros. Coloca una 'puerta' en cada hueco con arco. "
    "[4] TEXTOS: Lee TODOS los nombres de espacios (SALA, CUARTO, BAÑO, COCINA, GARAJE, PASILLO, COMEDOR). "
    "[5] SÍMBOLOS: Si ves escaleras, añade simbolo 'escalera'. "
    "[6] COTAS: Solo al final, extrae medidas numéricas (ej: 5.00m, 3.10). "
    "Formatos exactos (sin campos extra):\n"
    "{\"id\":\"m1\",\"tipo\":\"muro\",\"x\":50,\"y\":50,\"width\":400,\"height\":8}\n"
    "{\"id\":\"t1\",\"tipo\":\"texto\",\"x\":150,\"y\":200,\"texto\":\"SALA\",\"tamano_fuente\":14}\n"
    "{\"id\":\"c1\",\"tipo\":\"cota\",\"x1\":50,\"y1\":30,\"x2\":450,\"y2\":30,\"valor\":\"5.00m\"}\n"
    "DEVUELVE SOLO el array JSON. Si no puedes detectar muros, devuelve al menos el rectángulo perimetral."
)

PROMPT_SOLO_GEOMETRIA = (
    "Analiza esta imagen arquitectónica y devuelve UN ARRAY JSON OBLIGATORIAMENTE.\n"
    "Reglas críticas:\n"
    "1. NO extraigas números rojos ni cotas.\n"
    "2. EXTRAE MUROS (muro): Mapea TODAS las paredes interiores y exteriores como rectángulos finos.\n"
    "3. EXTRAE PUERTAS (puerta): Cada espacio o arco en una pared es una puerta.\n"
    "4. EXTRAE TEXTOS (texto): **ESTO ES LO MÁS IMPORTANTE**. Escribe CADA PALABRA que veas en las habitaciones (ej: SALA, COCINA, BAÑO, CUARTO, PASILLO). Si omites una palabra visible, tu respuesta es inútil.\n\n"
    "Formatos (usar píxeles 0-800):\n"
    "{\"id\":\"m1\",\"tipo\":\"muro\",\"x\":10,\"y\":10,\"width\":300,\"height\":10}\n"
    "{\"id\":\"t1\",\"tipo\":\"texto\",\"x\":150,\"y\":200,\"texto\":\"SALA\",\"tamano_fuente\":20}\n"
    "{\"id\":\"p1\",\"tipo\":\"puerta\",\"x\":100,\"y\":10,\"width\":40,\"height\":10}\n"
    "Devuelve SOLO el array JSON cerrado en []."
)


_ALLOWED_TIPOS = {"muro", "puerta", "ventana", "texto", "cota", "simbolo"}

_ESTILOS_VALIDOS = {
    "contemporaneo",
    "moderno",
    "colonial",
    "cabana",
    "artesano",
    "costero",
    "casa de campo",
}
_TECHO_VALIDO = {"techo plano", "techo inclinado", "techo a dos aguas", "techo a cuatro aguas"}
_CIMIENTOS_VALIDOS = {"losa", "sotano"}
_COCINA_VALIDA = {"abierta", "cerrada"}
_ESPACIOS_EXTERIORES_VALIDOS = {
    "porche delantero",
    "patio cubierto",
    "terraza",
    "balcon",
    "patio",
    "pasillo cubierto",
    "cocina exterior",
}


def _coerce_positive_int(value: Any) -> Optional[int]:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return parsed


def _sanitize_generation_options(opciones: Any) -> Dict[str, Any]:
    """Filtra opciones permitidas para evitar ruido en el prompt."""
    if not isinstance(opciones, dict):
        return {}

    salida: Dict[str, Any] = {}

    estilo = str(opciones.get("estilo") or "").strip().lower()
    if estilo in _ESTILOS_VALIDOS:
        salida["estilo"] = estilo

    area_m2 = _coerce_positive_int(opciones.get("area_m2"))
    if area_m2:
        salida["area_m2"] = area_m2

    pisos = _coerce_positive_int(opciones.get("pisos"))
    if pisos:
        salida["pisos"] = pisos

    dormitorios = _coerce_positive_int(opciones.get("dormitorios"))
    if dormitorios is not None:
        salida["dormitorios"] = dormitorios

    banos = _coerce_positive_int(opciones.get("banos"))
    if banos is not None:
        salida["banos"] = banos

    garaje = _coerce_positive_int(opciones.get("garaje"))
    if garaje is not None:
        salida["garaje"] = garaje

    tipo_techo = str(opciones.get("tipo_techo") or "").strip().lower()
    if tipo_techo in _TECHO_VALIDO:
        salida["tipo_techo"] = tipo_techo

    cimientos = str(opciones.get("cimientos") or "").strip().lower()
    if cimientos in _CIMIENTOS_VALIDOS:
        salida["cimientos"] = cimientos

    cocina = str(opciones.get("cocina") or "").strip().lower()
    if cocina in _COCINA_VALIDA:
        salida["cocina"] = cocina

    espacios = opciones.get("espacios_exteriores")
    if isinstance(espacios, list):
        limpios = [
            str(item).strip().lower()
            for item in espacios
            if str(item).strip().lower() in _ESPACIOS_EXTERIORES_VALIDOS
        ]
        if limpios:
            salida["espacios_exteriores"] = limpios

    return salida


def construir_prompt_dinamico(*, modo: str, prompt_usuario: str = "", opciones: Optional[Dict[str, Any]] = None) -> str:
    """Construye un prompt estable para imagen o texto."""
    modo = str(modo or "image").strip().lower()
    opciones = opciones or {}
    limpio = _sanitize_generation_options(opciones)
    solo_geometria = str(opciones.get("solo_geometria") or "").strip().lower() in {"1", "true", "si", "yes"}

    if modo == "text":
        base = (
            "Eres un arquitecto/delineante experto. Genera un plano 2D desde cero y devuelve SOLO un array JSON "
            "válido. Tipos permitidos: muro, puerta, ventana, texto, simbolo, cota. "
            "Sistema de coordenadas: origen (0,0) arriba a la izquierda, x a la derecha, y hacia abajo. "
            "Usa dimensiones coherentes para una vivienda residencial y prioriza circulación realista. "
            "Muros/puertas/ventanas: {id,tipo,x,y,width,height,rotation?}. "
            "texto: {id,tipo:'texto',x,y,texto,tamano_fuente?}. "
            "simbolo: {id,tipo:'simbolo',x,y,nombre,categoria?,rotacion?,escala?}. "
            "cota: {id,tipo:'cota',x1,y1,x2,y2,valor}. "
            "No uses polilíneas ni campos fuera del esquema. "
            "Ejemplo válido: [{\"id\":\"m1\",\"tipo\":\"muro\",\"x\":10,\"y\":20,\"width\":320,\"height\":15,\"rotation\":0}]."
        )
    else:
        base = SYSTEM_PROMPT

    if solo_geometria:
        base = (
            "Eres un arquitecto/delineante experto. Analiza la imagen del plano (2D) y extrae SOLO muros, puertas y ventanas. "
            "Devuelve ÚNICAMENTE un array JSON válido. "
            "Tipos permitidos: muro, puerta, ventana. Ignora texto, cotas, símbolos y anotaciones. "
            "Prioridad: (1) muros perimetrales (perímetro exterior), (2) muros interiores principales, (3) puertas, (4) ventanas. "
            "Representación: rectángulos alineados a ejes (x,y,width,height). No uses rotation. "
            "Evita fragmentación: prefiere muros largos y continuos."
        )

    lineas_extra: list[str] = []
    if limpio:
        lineas_extra.append("Preferencias guiadas:")
        for key, value in limpio.items():
            lineas_extra.append(f"- {key}: {value}")

    # En modo 'image' el prompt es 100% estático (SYSTEM_PROMPT).
    # No se agrega ningún texto libre del usuario para garantizar
    # resultados consistentes y predecibles (Punto 1).
    if prompt_usuario and modo != "image":
        lineas_extra.append(f"Indicaciones del usuario: {prompt_usuario.strip()}")

    lineas_extra.append(
        "Instrucción final: devuelve SOLO un array JSON válido (sin markdown, sin texto adicional, sin comas finales)."
    )

    if not solo_geometria:
        lineas_extra.append(
            "Checklist: incluye puertas/ventanas/muros y, si existen en el plano, añade cotas con su texto exacto y símbolos como 'escalera/gradas' y 'auto'."
        )
    return f"{base}\n\n" + "\n".join(lineas_extra)


def _extract_code_fence_payload(s: str) -> Optional[str]:
    # Busca el primer bloque ```...``` y devuelve su contenido.
    start = s.find("```")
    if start == -1:
        return None
    end = s.find("```", start + 3)
    if end == -1:
        return None

    inner = s[start + 3 : end]
    # Soporta ```json\n...```
    inner = inner.lstrip()
    if inner.lower().startswith("json"):
        inner = inner[4:]
    return inner.strip()


def _repair_truncated_json_array(s: str) -> Optional[str]:
    """Repara casos comunes: array que termina en coma y/o sin cerrar ']' (respuesta cortada)."""
    if not isinstance(s, str):
        return None
    t = s.strip()
    if not t.startswith("["):
        return None

    # Quita cualquier cosa antes del primer '[' (por si hay texto)
    start = t.find("[")
    t = t[start:]

    # Elimina paréntesis finales accidentales
    t = re.sub(r"\)+\s*$", "", t)

    # Quita comas colgantes antes de cierre y al final
    t = re.sub(r",\s*([\]}])", r"\1", t)
    t = re.sub(r",\s*$", "", t)

    # Si no cierra el array pero parece terminar en '}' o ']' agregamos cierre.
    if "]" not in t:
        tt = t.rstrip()
        if tt.endswith("}"):
            t = tt + "]"
        elif tt.endswith("]"):
            t = tt
        else:
            # Si termina en coma ya la quitamos; intentamos cerrar igual.
            t = tt + "]"

    return t


def _salvage_partial_json_array(s: str) -> Optional[str]:
    """Si el array está truncado dentro de un objeto, conserva elementos completos."""
    if not isinstance(s, str):
        return None
    t = s.strip()
    if not t.startswith("["):
        return None

    last_obj_end = t.rfind("}")
    if last_obj_end == -1:
        return None

    cut = t[: last_obj_end + 1]
    # Quita comas colgantes al final del array parcial
    cut = re.sub(r",\s*$", "", cut.strip())
    return cut + "]"


def _extract_balanced_slice(s: str, open_ch: str, close_ch: str) -> Optional[str]:
    """Extrae el primer bloque balanceado ([], {}) ignorando brackets dentro de strings."""
    start = s.find(open_ch)
    if start == -1:
        return None

    depth = 0
    in_string = False
    string_quote = ""
    escape = False
    for i in range(start, len(s)):
        ch = s[i]

        if in_string:
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == string_quote:
                in_string = False
                string_quote = ""
            continue

        if ch in ('"', "'"):
            in_string = True
            string_quote = ch
            continue

        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return s[start : i + 1]

    return None


def _unwrap_to_list(obj: Any) -> Any:
    if isinstance(obj, list):
        return obj
    if isinstance(obj, dict):
        for key in ("vector_data", "items", "data", "elements", "result", "shapes"):
            val = obj.get(key)
            if isinstance(val, list):
                return val
    return obj


def _select_gemini_model_name(genai, *, prefer_strong: bool) -> str:
    if prefer_strong:
        forced = str(getattr(settings, "GEMINI_MODEL_STRONG", "") or "").strip()
    else:
        forced = str(getattr(settings, "GEMINI_MODEL_FAST", "") or "").strip()

    # Backward compatible: si existe GEMINI_MODEL, lo respetamos en ambos caminos.
    forced_legacy = str(getattr(settings, "GEMINI_MODEL", "") or "").strip()
    if forced_legacy:
        return forced_legacy
    if forced:
        return forced

    preferred = (
        [
            # Más calidad (más caro/lento)
            "models/gemini-2.5-pro",
            "models/gemini-2.0-pro",
            "models/gemini-pro-latest",
            "models/gemini-2.5-flash",
        ]
        if prefer_strong
        else [
            # Más rápido (suele fallar en planos con líneas finas)
            "models/gemini-2.5-flash",
            "models/gemini-2.0-flash",
            "models/gemini-flash-latest",
            "models/gemini-2.0-flash-lite",
            "models/gemini-pro-latest",
        ]
    )

    try:
        available: List[str] = []
        for m in genai.list_models():
            name = str(getattr(m, "name", "") or "")
            methods = set(getattr(m, "supported_generation_methods", []) or [])
            if name and "generateContent" in methods:
                available.append(name)

        for p in preferred:
            if p in available:
                return p

        for name in available:
            if name.startswith("models/gemini"):
                return name

        if available:
            return available[0]
    except Exception:
        pass

    # Fallback conservador si list_models falla.
    return "models/gemini-2.0-flash" if not prefer_strong else "models/gemini-pro-latest"


def _generate_with_model(*, model, image_pil=None, prompt_dinamico: str = "") -> str:
    contenido: List[Any] = [
        (
            prompt_dinamico.strip()
            or "Devuelve SOLO un array JSON válido (sin markdown). No uses comas finales. "
            "Cierra el array con ']'. Usa números para x/y/width/height. "
            "Si no detectas nada, devuelve [] (array vacío)."
        )
    ]
    if image_pil is not None:
        contenido.append(image_pil)

    resp = model.generate_content(
        contenido,
        generation_config={
            "temperature": 0.0,
            "top_p": 0.1,
            "max_output_tokens": 8192,
            "response_mime_type": "application/json",
        },
    )

    text = getattr(resp, "text", None)
    if not text:
        raise GeminiServiceError("Gemini no devolvió texto. Intenta con otra imagen.")
    return str(text)


def _extract_json_array(text: str) -> Any:
    """Extrae el primer array JSON del texto (si Gemini añade texto extra)."""
    if not isinstance(text, str):
        raise GeminiServiceError("Respuesta inválida de Gemini (no es texto)")

    s = text.strip()

    # Si viene en bloque ```json ...```, usamos solo el contenido.
    fenced = _extract_code_fence_payload(s)
    if fenced:
        s = fenced

    # Reparación rápida (coma final / falta cierre).
    repaired = _repair_truncated_json_array(s)
    if repaired:
        s = repaired

    # Caso ideal: ya es JSON.
    try:
        return _unwrap_to_list(json.loads(s))
    except Exception:
        pass

    # Fallback seguro: a veces Gemini devuelve formato tipo Python (comillas simples).
    try:
        literal = ast.literal_eval(s)
        return _unwrap_to_list(literal)
    except Exception:
        pass

    # Salvataje: si parece truncado dentro de un objeto, recortamos a lo último completo.
    salvaged = _salvage_partial_json_array(s)
    if salvaged:
        try:
            return _unwrap_to_list(json.loads(salvaged))
        except Exception:
            try:
                return _unwrap_to_list(ast.literal_eval(salvaged))
            except Exception:
                pass

    # Intento: encontrar el primer bloque balanceado [ ... ] o { ... }.
    candidate = _extract_balanced_slice(s, "[", "]")
    if candidate is None:
        candidate = _extract_balanced_slice(s, "{", "}")
    if candidate is None:
        # Último intento: si inicia con '[' asumimos truncado y reparamos.
        repaired2 = _repair_truncated_json_array(s)
        if repaired2:
            candidate = repaired2
    if candidate and isinstance(candidate, str) and candidate.strip().startswith("["):
        salvaged2 = _salvage_partial_json_array(candidate)
        if salvaged2:
            candidate = salvaged2
    if candidate is None:
        raise GeminiServiceError(
            "La IA no devolvió un JSON reconocible. Intenta con una imagen más nítida o recorta el plano."
        )

    try:
        return _unwrap_to_list(json.loads(candidate))
    except Exception as e:
        try:
            literal = ast.literal_eval(candidate)
            return _unwrap_to_list(literal)
        except Exception:
            pass

        raise GeminiServiceError(
            "La IA devolvió JSON inválido. Intenta con otra imagen o recorta el plano."
        ) from e


def _coerce_number(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).strip())
    except Exception:
        return None


def _pick_number(item: dict, *keys: str) -> Optional[float]:
    for key in keys:
        val = _coerce_number(item.get(key))
        if val is not None:
            return val
    return None


def _sanitize_vector_item(item: Any, idx: int) -> Dict[str, Any]:
    if not isinstance(item, dict):
        raise GeminiServiceError(f"Elemento #{idx + 1} no es un objeto JSON")

    tipo = str(item.get("tipo") or "").strip().lower()
    if tipo not in _ALLOWED_TIPOS:
        raise GeminiServiceError(
            f"Elemento #{idx + 1}: 'tipo' inválido (esperado: muro, puerta o ventana)"
        )

    out: Dict[str, Any] = {
        "id": str(item.get("id") or f"{tipo[0]}{idx+1}"),
        "tipo": tipo,
    }

    if tipo == "texto":
        x = _pick_number(item, "x", "left", "izquierda")
        y = _pick_number(item, "y", "top", "arriba")
        if x is None or y is None:
            cx = _pick_number(item, "centro_x", "center_x", "cx")
            cy = _pick_number(item, "centro_y", "center_y", "cy")
            if cx is not None and cy is not None:
                x, y = cx, cy
        if x is None or y is None:
            raise GeminiServiceError(f"Elemento #{idx + 1}: texto requiere 'x'/'y' numéricos")

        texto = str(item.get("texto") or item.get("label") or item.get("nombre") or "").strip()
        if not texto:
            raise GeminiServiceError(f"Elemento #{idx + 1}: texto requiere 'texto'")

        fs = _coerce_positive_int(item.get("tamano_fuente") or item.get("font_size") or item.get("size"))
        out.update({"x": x, "y": y, "texto": texto})
        if fs:
            out["tamano_fuente"] = fs
        return out

    if tipo == "simbolo":
        x = _pick_number(item, "x", "left", "izquierda")
        y = _pick_number(item, "y", "top", "arriba")
        if x is None or y is None:
            cx = _pick_number(item, "centro_x", "center_x", "cx")
            cy = _pick_number(item, "centro_y", "center_y", "cy")
            if cx is not None and cy is not None:
                x, y = cx, cy
        if x is None or y is None:
            raise GeminiServiceError(f"Elemento #{idx + 1}: simbolo requiere 'x'/'y' numéricos")

        nombre = str(item.get("nombre") or item.get("name") or "").strip().lower()
        if not nombre:
            raise GeminiServiceError(f"Elemento #{idx + 1}: simbolo requiere 'nombre'")
        categoria = str(item.get("categoria") or item.get("category") or "").strip().lower() or None

        rotacion = _coerce_number(item.get("rotacion") or item.get("rotation"))
        escala = _coerce_number(item.get("escala") or item.get("scale"))
        if escala is None or not (0.1 <= escala <= 5.0):
            escala = 1.0

        out.update({"x": x, "y": y, "nombre": nombre, "escala": float(escala)})
        if categoria:
            out["categoria"] = categoria
        if rotacion is not None:
            out["rotacion"] = float(rotacion)
        return out

    if tipo == "cota":
        x1c = _pick_number(item, "x1", "inicio_x", "start_x")
        y1c = _pick_number(item, "y1", "inicio_y", "start_y")
        x2c = _pick_number(item, "x2", "fin_x", "end_x")
        y2c = _pick_number(item, "y2", "fin_y", "end_y")
        
        # Fallback tolerante si la IA solo envió x, y
        if None in (x1c, y1c, x2c, y2c):
            xb = _pick_number(item, "x", "left", "cx")
            yb = _pick_number(item, "y", "top", "cy")
            if xb is not None and yb is not None:
                # Simulamos una pequeña línea horizontal centrada en x,y
                x1c = xb - 20
                y1c = yb
                x2c = xb + 20
                y2c = yb
            else:
                raise GeminiServiceError(f"Elemento #{idx + 1}: cota requiere x1,y1,x2,y2 numéricos o x,y")

        valor = str(item.get("valor") or item.get("value") or item.get("texto") or "").strip()
        if not valor:
            # fallback: estimación por escala default (1m=100px)
            dx = float(x2c) - float(x1c)
            dy = float(y2c) - float(y1c)
            dist_px = (dx * dx + dy * dy) ** 0.5
            valor = f"{(dist_px / 100.0):.2f} m"

        out.update({"x1": x1c, "y1": y1c, "x2": x2c, "y2": y2c, "valor": valor})
        orient = str(item.get("orientacion") or item.get("orientation") or "").strip().lower()
        if orient:
            out["orientacion"] = orient
        return out

    # Coordenadas base (tolerante para salidas de IA con alias)
    x1 = _pick_number(item, "x1", "inicio_x", "start_x")
    y1 = _pick_number(item, "y1", "inicio_y", "start_y")
    x2 = _pick_number(item, "x2", "fin_x", "end_x")
    y2 = _pick_number(item, "y2", "fin_y", "end_y")

    x = _pick_number(item, "x", "left", "izquierda")
    y = _pick_number(item, "y", "top", "arriba")

    # Si no viene x/y, intentamos derivar desde x1/y1/x2/y2.
    if x is None and x1 is not None and x2 is not None:
        x = min(x1, x2)
    if y is None and y1 is not None and y2 is not None:
        y = min(y1, y2)

    # Soporte para centros (centro_x/centro_y + width/height o ancho/alto)
    if x is None or y is None:
        cx = _pick_number(item, "centro_x", "center_x", "cx")
        cy = _pick_number(item, "centro_y", "center_y", "cy")
        ww = _pick_number(item, "width", "ancho")
        hh = _pick_number(item, "height", "alto", "grosor")
        if cx is not None and cy is not None and ww is not None and hh is not None:
            x = cx - (ww / 2.0)
            y = cy - (hh / 2.0)

    if x is None or y is None:
        raise GeminiServiceError(f"Elemento #{idx + 1}: faltan 'x'/'y' numéricos")
    out["x"] = x
    out["y"] = y

    # Campos esperados (tolerante): muro usa longitud/grosor/orientacion o width/height.
    if tipo == "muro":
        longitud = _coerce_number(item.get("longitud"))
        grosor = _coerce_number(item.get("grosor"))
        orientacion = str(item.get("orientacion") or "").strip().lower()

        width = _pick_number(item, "width", "ancho")
        height = _pick_number(item, "height", "alto")

        # Si viene como segmento (x1,y1)->(x2,y2), lo convertimos a rectángulo.
        if width is None and height is None and None not in (x1, y1, x2, y2):
            dx = abs(x2 - x1)
            dy = abs(y2 - y1)
            grosor_default = _pick_number(item, "grosor", "thickness") or 15.0
            if dx >= dy:
                width = dx if dx > 0 else grosor_default
                height = grosor_default if dy == 0 else dy
            else:
                width = grosor_default if dx == 0 else dx
                height = dy if dy > 0 else grosor_default

        if width is not None and height is not None:
            out["width"] = width
            out["height"] = height
        elif longitud is not None and grosor is not None:
            # Convertimos a width/height para el canvas (horizontal por defecto)
            if orientacion not in {"horizontal", "vertical"}:
                orientacion = "horizontal"
            out["width"] = longitud if orientacion == "horizontal" else grosor
            out["height"] = grosor if orientacion == "horizontal" else longitud
        else:
            raise GeminiServiceError(
                f"Elemento #{idx + 1}: muro requiere width/height o longitud/grosor"
            )

        rot = _coerce_number(item.get("rotation") if item.get("rotation") is not None else item.get("rotacion"))
        if rot is not None:
            out["rotation"] = rot

    else:
        # puerta/ventana: usamos ancho (y opcional alto) o width/height
        width = _pick_number(item, "width", "ancho")
        height = _pick_number(item, "height", "alto")
        ancho = _pick_number(item, "ancho", "width")
        alto = _pick_number(item, "alto", "height")

        if width is not None and height is not None:
            out["width"] = width
            out["height"] = height
        elif ancho is not None:
            out["width"] = ancho
            out["height"] = alto if alto is not None else 15.0
        else:
            raise GeminiServiceError(
                f"Elemento #{idx + 1}: {tipo} requiere width/height o ancho"
            )

        rot = _coerce_number(item.get("rotation") if item.get("rotation") is not None else item.get("rotacion"))
        if rot is not None:
            out["rotation"] = rot

    return out


def _validate_vector_data(data: Any, *, allow_empty: bool = False) -> List[Dict[str, Any]]:
    if not isinstance(data, list):
        raise GeminiServiceError("La IA no devolvió un array JSON")
    
    sanitized: List[Dict[str, Any]] = []
    for idx, it in enumerate(data):
        try:
            sanitized.append(_sanitize_vector_item(it, idx))
        except Exception as e:
            # En lugar de fallar todo el plano, simplemente ignoramos el elemento malformado
            import logging
            logging.getLogger(__name__).warning(f"[GeminiService] Ignorando elemento malformado en índice {idx}: {e}")
            continue

    if len(sanitized) == 0 and not allow_empty:
        raise GeminiServiceError(
            "La IA no detectó geometría válida. Intenta con una imagen con mayor contraste."
        )

    return sanitized


def _normalize_vector_data(
    items: List[Dict[str, Any]],
    target_w: float = 800.0,
    target_h: float = 600.0,
    padding: float = 40.0,
) -> List[Dict[str, Any]]:
    """
    Escala automáticamente los datos vectoriales de Gemini para que encajen
    limpiamente en el canvas del editor (800x600) sin importar el sistema de
    coordenadas que usó la IA. Preserva las proporciones del plano original.
    """
    # Calcular bounding box de todo el contenido
    xs, ys = [], []
    for s in items:
        tipo = s.get("tipo", "")
        if tipo in {"muro", "puerta", "ventana", "texto", "simbolo"}:
            x = float(s.get("x") or 0)
            y = float(s.get("y") or 0)
            w = float(s.get("width") or 0)
            h = float(s.get("height") or 0)
            xs += [x, x + w]
            ys += [y, y + h]
        elif tipo == "cota":
            xs += [float(s.get("x1") or 0), float(s.get("x2") or 0)]
            ys += [float(s.get("y1") or 0), float(s.get("y2") or 0)]

    if not xs or not ys:
        return items

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    content_w = max_x - min_x
    content_h = max_y - min_y

    # Si el contenido ya está en un rango razonable (50-1200), no escalar
    if 50 <= content_w <= 1200 and 50 <= content_h <= 1200:
        return items

    if content_w == 0 or content_h == 0:
        return items

    # Calcular escala uniforme manteniendo proporciones
    available_w = target_w - padding * 2
    available_h = target_h - padding * 2
    scale = min(available_w / content_w, available_h / content_h)

    def sx(v):
        return round((float(v) - min_x) * scale + padding, 2)

    def sy(v):
        return round((float(v) - min_y) * scale + padding, 2)

    def sw(v):
        return round(float(v) * scale, 2)

    normalized = []
    for s in items:
        s = dict(s)
        tipo = s.get("tipo", "")
        if tipo in {"muro", "puerta", "ventana", "simbolo"}:
            s["x"] = sx(s.get("x", 0))
            s["y"] = sy(s.get("y", 0))
            if "width" in s:
                s["width"] = sw(s["width"])
            if "height" in s:
                s["height"] = sw(s["height"])
        elif tipo == "texto":
            s["x"] = sx(s.get("x", 0))
            s["y"] = sy(s.get("y", 0))
            # Escalar también el tamaño de fuente
            if "tamano_fuente" in s:
                s["tamano_fuente"] = max(10, round(float(s["tamano_fuente"]) * scale))
        elif tipo == "cota":
            s["x1"] = sx(s.get("x1", 0))
            s["y1"] = sy(s.get("y1", 0))
            s["x2"] = sx(s.get("x2", 0))
            s["y2"] = sy(s.get("y2", 0))
        normalized.append(s)
    return normalized


def procesar_plano_con_gemini(
    *,
    image_pil=None,
    prompt_usuario: str = "",
    opciones: Optional[Dict[str, Any]] = None,
    modo: str = "image",
) -> GeminiParseResult:
    """Llama a Gemini multimodal y devuelve datos vectoriales como array JSON validado."""
    api_key = getattr(settings, "GEMINI_API_KEY", "")
    if not api_key:
        raise GeminiServiceError(
            "GEMINI_API_KEY no está configurada en el backend."
        )

    try:
        import google.generativeai as genai
    except Exception as e:
        raise GeminiServiceError(
            "Dependencia google-generativeai no instalada en el backend."
        ) from e

    genai.configure(api_key=api_key)

    modo = str(modo or "image").strip().lower()
    if modo not in {"image", "text", "hybrid"}:
        modo = "image"
    if modo in {"image", "hybrid"} and image_pil is None:
        raise GeminiServiceError("Debes enviar una imagen para modo image/hybrid.")

    prompt_dinamico = construir_prompt_dinamico(
        modo=modo,
        prompt_usuario=prompt_usuario,
        opciones=opciones,
    )

    # Por defecto usamos modelo rápido (Flash). Si se desea un modelo más fuerte,
    # configurar GEMINI_MODEL o GEMINI_MODEL_STRONG.
    model_name = _select_gemini_model_name(genai, prefer_strong=False)
    raw = ""

    try:
        model = genai.GenerativeModel(model_name)

        raw = _generate_with_model(model=model, image_pil=image_pil, prompt_dinamico=prompt_dinamico)
        parsed = _extract_json_array(raw)
        vector_data = _normalize_vector_data(_validate_vector_data(parsed))

        # --- Retry automático si Gemini solo devuelvió cotas y ningún muro ---
        muros_count = sum(1 for s in vector_data if s.get("tipo") in {"muro", "puerta", "ventana"})
        if muros_count == 0 and image_pil is not None:
            import logging
            logging.getLogger(__name__).warning(
                "[GeminiService] Retry: no se detectaron muros en la primera respuesta. "
                f"Elementos recibidos: {[s.get('tipo') for s in vector_data]}"
            )
            try:
                raw2 = _generate_with_model(
                    model=model,
                    image_pil=image_pil,
                    prompt_dinamico=PROMPT_SOLO_GEOMETRIA,
                )
                parsed2 = _extract_json_array(raw2)
                vector_data2 = _normalize_vector_data(_validate_vector_data(parsed2, allow_empty=True))
                muros2 = sum(1 for s in vector_data2 if s.get("tipo") in {"muro", "puerta", "ventana"})
                if muros2 > 0:
                    # El retry encontró muros - combinamos: muros del retry + cotas/textos del original
                    cotas_y_textos = [s for s in vector_data if s.get("tipo") not in {"muro", "puerta", "ventana"}]
                    # Si el retry ya trajo textos, no los duplicamos.
                    textos_retry = sum(1 for s in vector_data2 if s.get("tipo") == "texto")
                    if textos_retry > 0:
                        cotas_y_textos = [s for s in cotas_y_textos if s.get("tipo") != "texto"]
                        
                    vector_data = vector_data2 + cotas_y_textos
                    raw = raw2
            except Exception:
                pass  # Si el retry falla, devolvemos lo original (las cotas al menos)

        import sys
        print(f"====== DEBUG GEMINI ======\nVECTOR_DATA: {vector_data}\n=======================", file=sys.stderr)
        return GeminiParseResult(vector_data=vector_data, raw_text=raw)

    except GeminiServiceError as e:
        # Fallback: si el modelo rápido no detecta geometría o devuelve algo no parseable,
        # reintentamos 1 vez con un modelo más fuerte SOLO si está configurado explícitamente.
        msg = str(e)
        should_retry = (
            "no detectó geometría" in msg.lower()
            or "no devolvió un json" in msg.lower()
            or "json reconocible" in msg.lower()
            or "json inválido" in msg.lower()
        )

        strong_forced = str(getattr(settings, "GEMINI_MODEL_STRONG", "") or "").strip()
        if should_retry and strong_forced:
            try:
                strong_name = _select_gemini_model_name(genai, prefer_strong=True)
                if strong_name != model_name:
                    strong_model = genai.GenerativeModel(strong_name)
                    raw2 = _generate_with_model(
                        model=strong_model,
                        image_pil=image_pil,
                        prompt_dinamico=prompt_dinamico,
                    )
                    parsed2 = _extract_json_array(raw2)
                    vector_data2 = _validate_vector_data(parsed2)
                    return GeminiParseResult(vector_data=vector_data2, raw_text=raw2)
            except GeminiServiceError:
                pass

        if getattr(settings, "DEBUG", False):
            cleaned = (raw or "").strip().replace("\r", " ").replace("\n", " ")
            start_preview = cleaned[:500]
            end_preview = cleaned[-300:] if len(cleaned) > 300 else cleaned
            raise GeminiServiceError(
                f"{e} (model={model_name}) (len={len(raw)}) (start={start_preview}) (end={end_preview})"
            ) from e
        raise
    except Exception as e:
        # En DEBUG devolvemos un hint del error real (sin exponer secretos)
        if getattr(settings, "DEBUG", False):
            msg = f"No se pudo procesar el plano con IA. (model={model_name}) ({type(e).__name__}: {e})"
        else:
            msg = "No se pudo procesar el plano con IA. Intenta nuevamente."
        raise GeminiServiceError(msg) from e


def analizar_imagen_plano(*, image_pil) -> GeminiParseResult:
    """
    Punto 1 — Procesamiento de imagen sin prompt del usuario.

    Esta función es la entrada dedicada para analizar una imagen de plano
    arquitectónico. Usa únicamente el SYSTEM_PROMPT estático definido en el
    backend; el usuario no ingresa ningún contexto ni prompt libre.

    Esto garantiza interpretaciones consistentes y predecibles: la IA siempre
    sabe exactamente qué debe extraer (muros, puertas, ventanas) sin verse
    influenciada por instrucciones variables del usuario.
    """
    if image_pil is None:
        raise GeminiServiceError(
            "Debes enviar una imagen del plano para analizarla."
        )
    return procesar_plano_con_gemini(
        image_pil=image_pil,
        prompt_usuario="",   # jamás acepta texto libre del usuario
        opciones=None,       # sin preferencias adicionales del usuario
        modo="image",
    )
