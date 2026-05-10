import base64
import io
import logging
from typing import Any

from django.conf import settings

from .gemini_service import (
    GeminiParseResult,
    GeminiServiceError,
    construir_prompt_dinamico,
    _extract_json_array,
    _validate_vector_data,
)


logger = logging.getLogger(__name__)


def _pil_to_base64(image_pil) -> str:
    buf = io.BytesIO()
    image_pil.save(buf, format="JPEG", quality=80, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _fingerprint_item(it: dict) -> str:
    t = str(it.get("tipo") or "").strip().lower()
    if t == "cota":
        def r(v):
            try:
                return round(float(v), 1)
            except Exception:
                return 0.0
        return f"cota:{r(it.get('x1'))},{r(it.get('y1'))},{r(it.get('x2'))},{r(it.get('y2'))}:{str(it.get('valor') or '').strip()}"
    if t == "texto":
        def r(v):
            try:
                return round(float(v), 1)
            except Exception:
                return 0.0
        return f"texto:{r(it.get('x'))},{r(it.get('y'))}:{str(it.get('texto') or '').strip()}"
    if t == "simbolo":
        def r(v):
            try:
                return round(float(v), 1)
            except Exception:
                return 0.0
        return f"simbolo:{r(it.get('x'))},{r(it.get('y'))}:{str(it.get('nombre') or '').strip().lower()}"
    # fallback
    return str(it)


def procesar_plano_con_openai(*, image_pil=None, prompt_usuario: str = "", opciones=None, modo: str = "image") -> GeminiParseResult:
    """Procesa una imagen con OpenAI Vision y devuelve vector_data como array JSON validado."""

    api_key = str(getattr(settings, "OPENAI_API_KEY", "") or "").strip()
    if not api_key:
        raise GeminiServiceError("OPENAI_API_KEY no está configurada en el backend.")

    # Modelo debe soportar vision: gpt-4o, gpt-4o-mini o gpt-4turbo
    model = str(getattr(settings, "OPENAI_MODEL", "gpt-4o") or "").strip()
    if not model:
        model = "gpt-4o"

    try:
        from openai import OpenAI
    except Exception as e:
        raise GeminiServiceError(
            "Dependencia openai no instalada en el backend. Agrega 'openai' a requirements.txt."
        ) from e

    client = OpenAI(api_key=api_key)

    modo = str(modo or "image").strip().lower()
    if modo not in {"image", "text", "hybrid"}:
        modo = "image"
    if modo in {"image", "hybrid"} and image_pil is None:
        raise GeminiServiceError("Debes enviar una imagen para modo image/hybrid.")

    prompt = construir_prompt_dinamico(
        modo=modo,
        prompt_usuario=prompt_usuario,
        opciones=opciones,
    )

    try:
        # Usamos Chat Completions API (mas estable para vision que responses.create)
        contenido: list[dict] = [{"type": "text", "text": prompt}]
        if image_pil is not None:
            b64_img = _pil_to_base64(image_pil)
            contenido.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"},
            })

        def do_request(use_model: str):
            return client.chat.completions.create(
                model=use_model,
                messages=[{"role": "user", "content": contenido}],
                temperature=0,
                top_p=0.1,
                max_tokens=4000,
            )

        try:
            resp = do_request(model)
        except Exception as e:
            # Fallback: si el modelo elegido no soporta imágenes, reintenta con gpt-4o.
            msg = str(e).lower()
            should_fallback = (
                image_pil is not None
                and model != "gpt-4o"
                and ("image" in msg or "vision" in msg or "multimodal" in msg)
            )
            if should_fallback:
                resp = do_request("gpt-4o")
                model = "gpt-4o"
            else:
                raise

        raw_text = str(resp.choices[0].message.content or "")
        if not raw_text:
            raise GeminiServiceError("OpenAI no devolvio texto en la respuesta.")

        parsed = _extract_json_array(raw_text)
        vector_data = _validate_vector_data(parsed)

        # Segundo pase: si faltan cotas, pedir SOLO cotas/textos de medida y mezclar.
        has_cotas = any(isinstance(it, dict) and str(it.get("tipo") or "").lower() == "cota" for it in vector_data)
        if (not has_cotas) and image_pil is not None and modo in {"image", "hybrid"}:
            try:
                prompt_dims = (
                    "Extrae SOLO cotas (tipo='cota') del plano. "
                    "NO devuelvas elementos tipo 'texto'. "
                    "Devuelve SOLO un array JSON válido. "
                    "Para 'cota' usa {id,tipo:'cota',x1,y1,x2,y2,valor}. 'valor' debe ser el texto exacto (ej: 27'-9.8\", 2'-6\", 1.78m). "
                    "Ubica (x1,y1)-(x2,y2) sobre la línea de cota con sus ticks/flechas. "
                    "Si no hay cotas legibles, devuelve []."
                )

                contenido2: list[dict] = [
                    {"type": "text", "text": prompt_dims},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{_pil_to_base64(image_pil)}"},
                    },
                ]

                resp2 = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": contenido2}],
                    temperature=0,
                    top_p=0.1,
                    max_tokens=2000,
                )

                raw2 = str(resp2.choices[0].message.content or "")
                if raw2:
                    parsed2 = _extract_json_array(raw2)
                    extras = _validate_vector_data(parsed2, allow_empty=True)
                    # Filtramos extras a cotas (evitar confundir cotas con etiquetas)
                    extras = [
                        it for it in extras
                        if str(it.get("tipo") or "").lower() in {"cota"}
                    ]

                    seen = {_fingerprint_item(it) for it in vector_data if isinstance(it, dict)}
                    merged = list(vector_data)
                    for it in extras:
                        fp = _fingerprint_item(it)
                        if fp in seen:
                            continue
                        merged.append(it)
                        seen.add(fp)

                    vector_data = merged
                    raw_text = f"{raw_text}\n\n---\n\n{raw2}"
            except Exception:
                logger.exception("Fallo segundo pase de cotas con OpenAI")

        return GeminiParseResult(vector_data=vector_data, raw_text=raw_text)

    except GeminiServiceError:
        raise
    except Exception as e:
        logger.exception("Fallo OpenAI Vision procesando plano")
        if getattr(settings, "DEBUG", False):
            msg = f"No se pudo procesar el plano con OpenAI. (model={model}) ({type(e).__name__}: {e})"
        else:
            msg = "No se pudo procesar el plano con IA. Intenta nuevamente."
        raise GeminiServiceError(msg) from e
