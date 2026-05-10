import json
import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


class ChatbotServiceError(Exception):
    """Errores controlados del servicio de chatbot (para devolver 4xx al frontend)."""


# Enumeracion textual de elementos - esto es lo que el chatbot "ve" del plano
# NO es una imagen, es texto plano que la IA puede procesar sin problemas de vision
ELEMENTOS_ENUMERADOS = """
Elementos actuales del plano (formato texto, NO imagen):
- Cada elemento tiene: id, tipo (muro|puerta|ventana), x, y, width, height, rotation
- Los muros forman el perimetro e interiores
- Las puertas son aberturas en los muros
- Las ventanas son aberturas para iluminacion

Ejemplo de contexto que recibiras:
{"selected_id": "p1", "shapes": [
  {"id":"m1","tipo":"muro","x":0,"y":0,"width":500,"height":10},
  {"id":"p1","tipo":"puerta","x":150,"y":100,"width":90,"height":15}
]}

Siempre usa este contexto para saper que elementos existen.
"""


SYSTEM_PROMPT = (
    "Eres un asistente de edicion de planos arquitectonicos. "
    "Responde SOLO en espanol. "
    "Devuelve SIEMPRE un JSON valido, sin markdown ni texto extra. "
    "Si la solicitud es ambigua, responde con action='ask' y una pregunta corta en 'reply'. "
    "Acciones permitidas: add, edit, delete, move, rotate, undo, redo, none, ask. "
    "Formato: "
    "- add: {action:'add', tipo:'muro|puerta|ventana', x:num, y:num, width:num, height:num, rotation?:num, reply?:str} "
    "- edit: {action:'edit', id:'shape_id', patch:{x?:num,y?:num,width?:num,height?:num,rotation?:num}, reply?:str} "
    "- delete: {action:'delete', id:'shape_id', reply?:str} "
    "- move: {action:'move', id:'shape_id', x:num, y:num, reply?:str} "
    "- rotate: {action:'rotate', id:'shape_id', rotation:num, reply?:str} "
    "- undo/redo: {action:'undo'|'redo', reply?:str} "
    "- none: {action:'none', reply:'No entendi la solicitud.'} "
    f"\n\n{ELEMENTOS_ENUMERADOS}"
)


def _sanitize_history(history: Any) -> list[dict[str, str]]:
    if not isinstance(history, list):
        return []
    allowed_roles = {"user", "assistant"}
    salida: list[dict[str, str]] = []
    for item in history[-10:]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip().lower()
        content = str(item.get("content") or "").strip()
        if role not in allowed_roles or not content:
            continue
        salida.append({"role": role, "content": content[:800]})
    return salida


def _sanitize_shapes(shapes: Any) -> list[dict[str, Any]]:
    if not isinstance(shapes, list):
        return []
    salida: list[dict[str, Any]] = []
    for s in shapes[:200]:
        if not isinstance(s, dict):
            continue
        salida.append(
            {
                "id": s.get("id"),
                "tipo": s.get("tipo"),
                "x": s.get("x"),
                "y": s.get("y"),
                "width": s.get("width"),
                "height": s.get("height"),
                "rotation": s.get("rotation"),
                "x1": s.get("x1"),
                "y1": s.get("y1"),
                "x2": s.get("x2"),
                "y2": s.get("y2"),
                "valor": s.get("valor"),
                "texto": s.get("texto"),
            }
        )
    return salida


def procesar_chatbot_plano(
    *,
    message: str,
    shapes: list[dict[str, Any]],
    selected_id: Any = None,
    history: Any = None,
) -> dict[str, Any]:
    api_key = str(getattr(settings, "OPENAI_API_KEY", "") or "").strip()
    if not api_key:
        raise ChatbotServiceError("OPENAI_API_KEY no esta configurada en el backend.")

    # Para el chatbot de edicion de planos, forzamos modelo de texto (NO vision)
    model = str(getattr(settings, "OPENAI_CHAT_MODEL", "") or "").strip()
    if not model or model.lower().replace("-", "").replace(".", "").find("vision") >= 0:
        model = "gpt-4o-mini"  # Modelo de texto, rapido y barato

    try:
        from openai import OpenAI
    except Exception as exc:
        raise ChatbotServiceError(
            "Dependencia openai no instalada en el backend. Agrega 'openai' a requirements.txt."
        ) from exc

    client = OpenAI(api_key=api_key)

    clean_history = _sanitize_history(history)
    clean_shapes = _sanitize_shapes(shapes)

    contexto = {
        "selected_id": selected_id,
        "shapes": clean_shapes,
    }

    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *clean_history,
        {"role": "user", "content": message.strip()},
        {"role": "user", "content": f"Contexto del plano: {json.dumps(contexto)}"},
    ]

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
            response_format={"type": "json_object"},
            max_completion_tokens=1200,
        )
    except Exception as exc:
        logger.exception("Fallo OpenAI chatbot plano")
        raise ChatbotServiceError("No se pudo procesar la solicitud con OpenAI.") from exc

    raw_text = str(resp.choices[0].message.content or "").strip()
    if not raw_text:
        raise ChatbotServiceError("OpenAI no devolvio contenido.")

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        logger.warning("Respuesta OpenAI no es JSON: %s", raw_text[:200])
        raise ChatbotServiceError("Respuesta invalida del asistente.") from exc

    if not isinstance(parsed, dict) or not parsed.get("action"):
        raise ChatbotServiceError("Respuesta incompleta del asistente.")

    return parsed
