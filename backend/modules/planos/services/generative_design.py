import logging
import json
from django.conf import settings
from modules.planos.models import Plano
from modules.planos.services.gemini_service import GeminiServiceError

logger = logging.getLogger(__name__)

def generar_diseños_alternativos(plano_original: Plano, opciones: dict) -> list[Plano]:
    """
    Utiliza Gemini 2.5 Flash para generar versiones alternativas del plano actual.
    Optimiza costo, tiempo de obra, sostenibilidad, etc.
    """
    api_key = str(getattr(settings, "GEMINI_API_KEY", "") or "").strip()
    if not api_key:
        raise GeminiServiceError("GEMINI_API_KEY no está configurada en el backend.")
        
    model_name = str(getattr(settings, "GEMINI_MODEL_FAST", "gemini-2.5-flash") or "gemini-2.5-flash").strip()
    
    try:
        import google.generativeai as genai
    except Exception as e:
        raise GeminiServiceError("Dependencia google-generativeai no instalada.") from e
        
    genai.configure(api_key=api_key)
    
    # Preparar los datos vectoriales actuales
    datos_actuales = plano_original.datos_vectoriales
    datos_json = json.dumps(datos_actuales)
    
    costo_actual = float(opciones.get("costo_actual", 10000.0) or 10000.0)
    cantidad = min(max(int(opciones.get("cantidad", 3)), 1), 3) # Max 3 para no saturar

    # Heurísticas para establecer una línea base si no existen en el cálculo actual
    tiempo_actual = max(int(costo_actual / 100), 5) # Ej: 100 Bs de trabajo por día
    co2_actual = costo_actual * 0.5 # Ej: 0.5 kg de CO2 por cada Bs invertido
    
    prompt = f"""
Eres un arquitecto experto en diseño generativo y optimización multi-objetivo.
El usuario quiere {cantidad} alternativa(s) de este plano 2D, optimizando costo, tiempo, y sostenibilidad.
Los parámetros del usuario son: {json.dumps(opciones)}
METRICAS BASE DEL PROYECTO ACTUAL:
- Costo actual: {costo_actual:.2f} Bs
- Tiempo de obra estimado: {tiempo_actual} días
- Huella de CO2 estimada: {co2_actual:.2f} kg

Los datos vectoriales del plano actual (en formato JSON) son:
{datos_json}

Reglas:
1. Genera exactamente {cantidad} alternativa(s).
2. Cada alternativa debe tener una ligera variación en la distribución (por ejemplo, mover o eliminar paredes no estructurales, cambiar el uso de los espacios).
3. Conserva el formato JSON de los datos vectoriales tal cual, solo modificado para la alternativa.
4. MUY IMPORTANTE - COMPORTAMIENTO SEGÚN EL ENFOQUE:
   Debes ajustar "costo_estimado", "tiempo_estimado_dias", "co2_estimado" y "puntuacion_sostenibilidad" basándote en la línea base y el enfoque elegido.
   - Si el enfoque es 'economico': El costo DEBE ser MENOR a {costo_actual:.2f} Bs (reduce área o muros).
   - Si el enfoque es 'rapido': El tiempo_estimado_dias DEBE ser MENOR a {tiempo_actual} días (diseño más simple, menos muros transversales).
   - Si el enfoque es 'sostenible': El co2_estimado DEBE ser MENOR a {co2_actual:.2f} kg y la puntuación de sostenibilidad debe ser > 90.
   - Si el enfoque es 'balanceado': Reduce ligeramente costo, tiempo y CO2 de forma equilibrada.
5. JAMÁS inventes costos absurdamente altos (ej. de decenas de miles) si la línea base es baja (ej. miles). Todos los valores deben fluctuar en +/- 20% alrededor de las métricas base según el enfoque.
6. Devuelve SOLO un array JSON válido con la siguiente estructura exacta:
[
  {{
    "vector_data": [...],
    "costo_estimado": {costo_actual * 0.85:.2f},
    "tiempo_estimado_dias": {max(int(tiempo_actual * 0.8), 1)},
    "co2_estimado": {co2_actual * 0.85:.2f},
    "puntuacion_sostenibilidad": 85
  }},
  ...
]
Devuelve SOLO el JSON sin markdown adicional ni explicaciones.
"""
    
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        text = response.text
        
        # Limpiar markdown si Gemini lo incluye
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        resultados = json.loads(text.strip())
        
        alternativas_creadas = []
        for index, res in enumerate(resultados[:cantidad]):
            prefijo = f"Alternativa {index+1} (IA) - "
            nombre_truncado = plano_original.nombre[:(200 - len(prefijo))]
            nueva_alt = Plano.objects.create(
                proyecto=plano_original.proyecto,
                nombre=f"{prefijo}{nombre_truncado}",
                datos_vectoriales=res.get("vector_data", []),
                modo_generacion="generative_ai",
                escala_metros_por_pixel=plano_original.escala_metros_por_pixel,
                es_alternativa=True,
                plano_original=plano_original,
                costo_estimado=res.get("costo_estimado", 0),
                tiempo_estimado_dias=res.get("tiempo_estimado_dias", 0),
                co2_estimado=res.get("co2_estimado", 0),
                puntuacion_sostenibilidad=res.get("puntuacion_sostenibilidad", 0)
            )
            alternativas_creadas.append(nueva_alt)
            
        return alternativas_creadas
        
    except Exception as e:
        logger.exception("Fallo en Gemini Generative Design")
        raise GeminiServiceError(f"Error generando diseños: {str(e)}")
