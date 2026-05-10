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
    "Eres un arquitecto/delineante experto. Analiza la imagen de un plano (2D) y extrae elementos vectoriales editables. "
    "Devuelve ÚNICAMENTE un array JSON válido (sin markdown, sin texto adicional). "
    "Sistema de coordenadas: origen (0,0) en la esquina superior izquierda de la imagen; x hacia la derecha; y hacia abajo. "
    "Unidades: píxeles aproximados de la imagen enviada. "
    "Elementos permitidos (tipo): muro, puerta, ventana, texto, cota, simbolo. "
    "Prioridad de extracción: (1) muros perimetrales (perímetro exterior cerrado), (2) muros interiores principales, (3) puertas, (4) ventanas, (5) anotaciones (texto/cotas), (6) símbolos. "
    "Representación: muros/puertas/ventanas como rectángulos (x,y,width,height). Evita rotation: usa rectángulos alineados a ejes (solo 0°). "
    "Muros: deben ser segmentos largos con grosor uniforme (líneas gruesas). Evita fragmentar un mismo muro en muchos pedazos: prefiere menos muros más largos. "
    "Regla CLAVE: NO uses tipo 'texto' para medidas. Todas las medidas (con unidades como m, cm, mm, pies/pulgadas o fracciones) deben ser tipo 'cota'. "
    "texto: SOLO para etiquetas que NO sean medidas (ej: nombres de ambientes, notas, 'Sala', 'Cocina'). Si dudas, usa 'cota'. "
    "texto: {id,tipo:'texto',x,y,texto,tamano_fuente?}. "
    "cota: {id,tipo:'cota',x1,y1,x2,y2,valor} (valor en metros si se puede leer del plano, ej '3.20 m'). "
    "simbolo: {id,tipo:'simbolo',x,y,nombre,categoria?,rotacion?,escala?} (nombre sugeridos: 'escalera'/'gradas', 'auto', 'cama', 'inodoro'). "
    "Medidas: si el plano tiene cotas con texto (ej: '1.78m', '2.40 m', '27'-9.8\"', '2'-6\"'), genera un elemento 'cota' por cada una. "
    "Para cada cota, ubica (x1,y1)-(x2,y2) EXACTAMENTE sobre la línea de cota (la línea fina con flechas/ticks), no sobre el muro. "
    "Los endpoints (x1,y1) y (x2,y2) deben caer sobre los ticks/flechas y alinearse con las líneas de extensión que tocan la CARA del muro medido. "
    "La cota debe ser paralela al muro que mide (horizontal o vertical). "
    "No redondees agresivamente: conserva el texto tal cual aparece. "
    "Reglas: (1) NO inventes elementos fuera del dibujo; (2) evita duplicados; (3) prioriza muros perimetrales y divisiones principales; "
    "(4) si hay duda entre puerta/ventana, clasifica como 'puerta' solo si se aprecia abertura/arco; caso contrario 'ventana'; "
    "(5) si no puedes leer una medida, omite esa cota en vez de inventarla. "
    "Ejemplo mínimo válido: "
    "[{\"id\":\"m1\",\"tipo\":\"muro\",\"x\":10,\"y\":20,\"width\":300,\"height\":15,\"rotation\":0},"
    "{\"id\":\"p1\",\"tipo\":\"puerta\",\"x\":120,\"y\":35,\"width\":90,\"height\":15,\"rotation\":0},"
    "{\"id\":\"t1\",\"tipo\":\"texto\",\"x\":60,\"y\":60,\"texto\":\"Cocina\",\"tamano_fuente\":16},"
    "{\"id\":\"s1\",\"tipo\":\"simbolo\",\"x\":200,\"y\":120,\"nombre\":\"escalera\",\"categoria\":\"circulacion\",\"rotacion\":0,\"escala\":1}]."
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
        if None in (x1c, y1c, x2c, y2c):
            raise GeminiServiceError(f"Elemento #{idx + 1}: cota requiere x1,y1,x2,y2 numéricos")

        valor = str(item.get("valor") or item.get("value") or "").strip()
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
    if len(data) == 0 and not allow_empty:
        raise GeminiServiceError(
            "La IA no detectó geometría. Intenta con una imagen con mayor contraste."
        )

    sanitized: List[Dict[str, Any]] = []
    for idx, it in enumerate(data):
        sanitized.append(_sanitize_vector_item(it, idx))
    return sanitized


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
        vector_data = _validate_vector_data(parsed)
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
