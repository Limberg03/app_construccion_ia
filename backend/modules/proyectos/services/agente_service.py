import logging
from typing import Any, Dict
from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import APIException
from modules.presupuestos.models import Presupuesto, PresupuestoItem
from modules.planos.models import Plano
import json

logger = logging.getLogger(__name__)

class AgenteServiceError(APIException):
    status_code = 400
    default_detail = "Error en el agente IA."

def optimizar_presupuesto(proyecto_id: int, reduccion_porcentaje: int) -> dict:
    """Optimiza un presupuesto reduciendo costos.
    
    Args:
        proyecto_id: El ID del proyecto.
        reduccion_porcentaje: Porcentaje de reducción deseado (ej. 15).
    """
    # Aquí en el futuro llamaremos a módulos reales de la BD.
    # Por ahora, simulamos.
    return {
        "status": "simulado",
        "accion_tipo": "optimizar_presupuesto",
        "payload": {"reduccion_porcentaje": reduccion_porcentaje},
        "mensaje": f"He analizado la estructura de costos actual. He preparado una estrategia de optimización que reduce en un **{reduccion_porcentaje}%** el precio de todos los materiales. \n\nSi aplicas estos cambios, generaré un **nuevo presupuesto borrador** en tu base de datos para que puedas comparar las diferencias sin afectar el presupuesto original.\n\n¿Deseas proceder con esta optimización financiera?",
        "acciones": ["Aplicar cambios"]
    }

def redisenar_plano(proyecto_id: int, nuevo_dormitorios: int) -> dict:
    """Rediseña el plano arquitectónico cambiando la cantidad de cuartos/dormitorios.
    
    Args:
        proyecto_id: El ID del proyecto.
        nuevo_dormitorios: La cantidad de dormitorios que se desea tener.
    """
    return {
        "status": "simulado",
        "accion_tipo": "redisenar_plano",
        "payload": {"nuevo_dormitorios": nuevo_dormitorios},
        "mensaje": f"He evaluado la topología del plano arquitectónico actual. \n\nPuedo utilizar un modelo geométrico generativo para recalcular las particiones internas, muros y puertas, con el objetivo de adaptar el espacio para albergar **{nuevo_dormitorios} dormitorios**.\n\nEste proceso creará una **nueva alternativa de plano** en tu dashboard para que puedas abrirla en el editor CAD y ajustarla.\n\n¿Procedo a generar el nuevo diseño estructural?",
        "acciones": ["Aplicar cambios"]
    }

def generar_cronograma(proyecto_id: int) -> dict:
    """Genera un cronograma óptimo evaluando los datos del proyecto.
    
    Args:
        proyecto_id: El ID del proyecto.
    """
    return {
        "status": "simulado",
        "accion_tipo": "generar_cronograma",
        "payload": {},
        "mensaje": "He recolectado los datos del proyecto, incluyendo los volúmenes de materiales y alcance general.\n\nEstoy listo para procesar esta información y generar un **Cronograma de Obra Detallado** (Gantt-style), incluyendo un análisis de factores de riesgo climatológico y tiempos de mitigación.\n\n¿Deseas que ejecute el análisis temporal ahora mismo?",
        "acciones": ["Generar cronograma real"]
    }

def generar_cronograma_pdf(proyecto_id: int) -> dict:
    return {
        "status": "simulado",
        "accion_tipo": "generar_cronograma_pdf",
        "payload": {},
        "mensaje": "He recolectado los datos del proyecto y estoy listo para generar el cronograma en PDF descargable con formato profesional.\n\n¿Deseas generar el PDF ahora mismo?",
        "acciones": ["Descargar PDF"]
    }

# Mapa de herramientas disponibles
TOOLS_MAP = {
    "optimizar_presupuesto": optimizar_presupuesto,
    "redisenar_plano": redisenar_plano,
    "generar_cronograma": generar_cronograma,
    "generar_cronograma_pdf": generar_cronograma_pdf
}

def ejecutar_accion_agente(proyecto, accion_tipo: str, payload: dict) -> dict:
    if accion_tipo == "optimizar_presupuesto":
        reduccion = payload.get("reduccion_porcentaje", 10)
        
        # Encontrar el presupuesto más reciente del proyecto
        presupuesto = Presupuesto.objects.filter(proyecto=proyecto).first()
        if not presupuesto:
            raise AgenteServiceError("No se encontró ningún presupuesto en este proyecto.")
            
        with transaction.atomic():
            # Crear un nuevo presupuesto como versión borrador
            nuevo_presupuesto = Presupuesto.objects.create(
                proyecto=proyecto,
                nombre=f"{presupuesto.nombre} (Optimizado por IA -{reduccion}%)",
                notas=f"Versión autogenerada por el Asistente IA. Reducción de costos del {reduccion}%"
            )
            
            # Copiar ítems con precios reducidos
            factor = 1 - (reduccion / 100.0)
            items_a_crear = []
            original_total = 0
            
            for item in presupuesto.items.all():
                original_total += float(item.cantidad) * float(item.precio_unitario)
                nuevo_precio = float(item.precio_unitario) * factor
                items_a_crear.append(
                    PresupuestoItem(
                        presupuesto=nuevo_presupuesto,
                        material=item.material,
                        cantidad=item.cantidad,
                        precio_unitario=nuevo_precio
                    )
                )
            PresupuestoItem.objects.bulk_create(items_a_crear)
            
            nuevo_total = original_total * factor
            ahorro = original_total - nuevo_total
            
        # Formatear moneda
        def fmt(val): return f"Bs. {val:,.2f}"
            
        return {
            "role": "assistant",
            "content": f"✅ **Optimización completada con éxito.**\n\nHe creado un nuevo presupuesto titulado: `{nuevo_presupuesto.nombre}`.\n\n### 📊 Resumen Financiero:\n- **Presupuesto Original:** {fmt(original_total)}\n- **Presupuesto Optimizado:** {fmt(nuevo_total)}\n- **Ahorro Total Estimado:** 🟢 **{fmt(ahorro)}**\n\nTodos los materiales han sido recalculados. Puedes revisar este nuevo presupuesto en la vista principal del proyecto."
        }
        
    elif accion_tipo == "redisenar_plano":
        nuevo_dormitorios = payload.get("nuevo_dormitorios", 4)
        plano = Plano.objects.filter(proyecto=proyecto).order_by('-id').first()
        if not plano or not plano.datos_vectoriales:
            raise AgenteServiceError("El proyecto no tiene un plano vectorial base para rediseñar.")
            
        import google.generativeai as genai
        api_key = getattr(settings, "GEMINI_API_KEY", "")
        genai.configure(api_key=api_key)
        
        prompt = f"""
        Eres un arquitecto experto.
        Tengo el siguiente plano en formato JSON vectorial:
        {json.dumps(plano.datos_vectoriales)}
        
        Modifica este JSON agregando o moviendo 'muro', 'puerta' y 'texto' para que en total haya {nuevo_dormitorios} habitaciones marcadas con texto "DORMITORIO". 
        Mantén la estructura del JSON estricta (una lista de objetos con id, tipo, x, y, width, height, etc).
        Retorna ÚNICAMENTE el JSON crudo en un bloque de código markdown ```json ... ```.
        """
        model = genai.GenerativeModel(model_name="gemini-2.5-flash")
        response = model.generate_content(prompt)
        text_resp = response.text
        
        # Extraer JSON de la respuesta
        import re
        match = re.search(r'```(?:json)?\s*(\[\s*\{.*?\}\s*\])\s*```', text_resp, re.DOTALL)
        if match:
            json_str = match.group(1)
            try:
                nuevo_vector = json.loads(json_str)
                Plano.objects.create(
                    proyecto=proyecto,
                    nombre=f"Alternativa IA: {nuevo_dormitorios} Dorm.",
                    datos_vectoriales=nuevo_vector
                )
                return {
                    "role": "assistant",
                    "content": f"✅ **Diseño Generativo Finalizado.**\n\nHe creado una nueva versión arquitectónica vectorial con {nuevo_dormitorios} dormitorios. La encontrarás en la lista de planos de tu dashboard como `Alternativa IA: {nuevo_dormitorios} Dorm.`.\n\nPuedes abrirla en el Editor CAD para realizar los últimos ajustes manuales."
                }
            except Exception as e:
                logger.error(f"Error parseando JSON de rediseño: {e}")
                
        return {
            "role": "assistant",
            "content": "Intenté rediseñar el plano, pero hubo un problema al generar la nueva geometría. La arquitectura del espacio actual podría no soportar esa cantidad de divisiones."
        }
        
    elif accion_tipo == "generar_cronograma":
        presupuesto = Presupuesto.objects.filter(proyecto=proyecto).first()
        items_str = "No hay presupuesto."
        if presupuesto:
            items_str = ", ".join([i.material.nombre for i in presupuesto.items.all()[:10]])
            
        import google.generativeai as genai
        api_key = getattr(settings, "GEMINI_API_KEY", "")
        genai.configure(api_key=api_key)
        
        prompt = f"""
        Actúa como un gerente de construcción. 
        El proyecto '{proyecto.titulo}' ({proyecto.descripcion}) tiene estos materiales principales: {items_str}.
        
        Genera un cronograma de trabajo detallado de 4 semanas en formato Markdown.
        Incluye un análisis de riesgos climatológicos (ej. lluvias) realista para la zona, y cómo mitigarlo.
        Sé muy profesional.
        """
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            safety_settings=[
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ]
        )
        response = model.generate_content(prompt)
        
        return {
            "role": "assistant",
            "content": f"✅ **Planificación Generada Exitosamente:**\n\n{response.text}"
        }
        
    elif accion_tipo == "generar_cronograma_pdf":
        presupuesto = Presupuesto.objects.filter(proyecto=proyecto).first()
        items_str = "No hay presupuesto."
        if presupuesto:
            items_str = ", ".join([i.material.nombre for i in presupuesto.items.all()[:10]])
            
        import google.generativeai as genai
        import os
        import json
        from django.conf import settings
        from django.core.files.storage import FileSystemStorage
        from .pdf_cronograma import crear_pdf_cronograma
        
        api_key = getattr(settings, "GEMINI_API_KEY", "")
        genai.configure(api_key=api_key)
        
        plano = Plano.objects.filter(proyecto=proyecto).first()
        geometria_str = "No hay plano disponible."
        if plano and plano.datos_vectoriales:
            vectores = plano.datos_vectoriales
            muros = sum(1 for v in vectores if v.get('tipo') == 'muro')
            puertas = sum(1 for v in vectores if v.get('tipo') == 'puerta')
            textos = [v.get('texto') for v in vectores if v.get('tipo') == 'texto' and v.get('texto')]
            geometria_str = f"{muros} muros, {puertas} puertas. Habitaciones: {', '.join(textos) if textos else 'no especificadas'}."

        prompt = f"""
        Eres un gerente de obras experto en Bolivia/Latinoamérica.
        Proyecto: '{proyecto.titulo}' — {proyecto.descripcion or 'sin descripción adicional'}.
        Materiales del presupuesto detectados: {items_str}.
        Geometría del plano: {geometria_str}

        Genera un CRONOGRAMA DE EJECUCIÓN DE OBRA COMPLETO Y REALISTA de 10 semanas dividido en 4 fases, 
        y EXPORTA ESTRICTAMENTE EN FORMATO JSON puro (sin texto antes ni después, sin bloques ```), con esta estructura:

        {{
            "proyecto": "{proyecto.titulo}",
            "descripcion": "{proyecto.descripcion or ''}",
            "total_semanas": 10,
            "fases": [
                {{
                    "numero": 1,
                    "titulo": "Fase 1: Obra Gruesa y Cimentación",
                    "color": "#0EA5E9",
                    "semanas": [
                        {{
                            "semana": 1,
                            "titulo": "Semana 1: Preparación, Replanteo y Plomería Subterránea",
                            "critico": true,
                            "actividades": [
                                {{
                                    "descripcion": "Limpieza y replanteo topográfico del terreno",
                                    "materiales": "Estacas, tiralíneas, yeso de trazado",
                                    "notas": ""
                                }},
                                {{
                                    "descripcion": "Excavación de zanjas para cimientos y desagüe sanitario",
                                    "materiales": "Retroexcavadora, picos, palas",
                                    "notas": "CRÍTICO: Instalar tuberías de desagüe antes de vaciar cimientos"
                                }}
                            ]
                        }}
                    ]
                }}
            ],
            "materiales_completos": [
                {{
                    "categoria": "Estructura",
                    "items": ["Cemento Portland (bolsas)", "Arena fina y gruesa (m³)", "Grava (m³)", "Ladrillo gambote 6x12x18", "Acero de refuerzo fy=420 Mpa", "Alambre negro #16"]
                }},
                {{
                    "categoria": "Instalaciones Sanitarias",
                    "items": ["Tubería PVC 4\" (desagüe)", "Tubería termofusión 1/2\" (agua fría)", "Codos, tes, uniones PVC", "Artefactos sanitarios (inodoro, lavamanos, ducha)", "Griferías"]
                }},
                {{
                    "categoria": "Instalaciones Eléctricas",
                    "items": ["Cable eléctrico 2.5mm² y 4mm²", "Ductos corrugados", "Cajas eléctricas", "Tablero de distribución", "Interruptores y enchufes", "Luminarias"]
                }},
                {{
                    "categoria": "Acabados",
                    "items": ["Yeso para revoque fino", "Masilla para empastado", "Pintura interior látex (2 manos)", "Pintura exterior impermeabilizante", "Cerámica o porcelanato (m²)", "Fragua y adhesivo cerámico"]
                }},
                {{
                    "categoria": "Carpintería y Aberturas",
                    "items": ["Marcos y hojas de puertas", "Ventanas de aluminio o PVC", "Herrajes y cerraduras"]
                }}
            ],
            "riesgos_climaticos": [
                {{
                    "riesgo": "Precipitaciones / Lluvia intensa",
                    "impacto": "Alto",
                    "mitigacion": "Cubrir excavaciones y concreto fresco con lonas. Programar vaciados en horario matutino. Semana 10 como buffer de contingencia."
                }},
                {{
                    "riesgo": "Humedad extrema en época de lluvias",
                    "impacto": "Medio",
                    "mitigacion": "Retrasar pintura y masillado hasta que la humedad relativa baje del 70%. Usar aditivos acelerantes de fraguado si es necesario."
                }},
                {{
                    "riesgo": "Viento fuerte (encofrados y andamios)",
                    "impacto": "Medio",
                    "mitigacion": "Asegurar andamios con tensores. Suspender trabajos en altura si el viento supera 50 km/h."
                }}
            ]
        }}

        INSTRUCCIONES CRÍTICAS:
        - Las 4 fases deben ser: Fase 1 (Semanas 1-3: Obra Gruesa), Fase 2 (Semanas 4-6: Curado y Revoques), Fase 3 (Semanas 7-9: Acabados), Fase 4 (Semana 10: Buffer/Contingencia).
        - Cada semana debe tener entre 3 y 5 actividades detalladas y realistas.
        - Los materiales DEBEN mencionarse aunque no estén en el presupuesto (pintura, cerámica, etc.).
        - Las actividades "CRÍTICO" deben marcarse con critico: true en la semana.
        - La Semana 10 es exclusivamente para absorber retrasos climáticos.
        - Devuelve SOLO el JSON, sin bloques de código, sin explicaciones adicionales.
        """
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            safety_settings=[
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ]
        )
        response = model.generate_content(prompt)
        text_resp = response.text
        
        import re
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text_resp, re.DOTALL)
        if match:
            text_resp = match.group(1)
            
        try:
            datos_json = json.loads(text_resp)
        except Exception as e:
            return {
                "role": "assistant",
                "content": f"Ocurrió un error al formatear el JSON para el PDF: {e}"
            }
            
        pdf_buffer = crear_pdf_cronograma(proyecto, datos_json)
        
        fs = FileSystemStorage(location=os.path.join(settings.MEDIA_ROOT, 'cronogramas'))
        
        # Nombre de archivo profesional basado en el titulo del proyecto
        import re
        slug = re.sub(r'[^a-zA-Z0-9_]', '_', proyecto.titulo.strip())[:30]
        filename = f"cronograma_{slug}.pdf"
        download_name = f"Cronograma_de_Obra_{slug}.pdf"
        
        if fs.exists(filename):
            fs.delete(filename)
        
        from django.core.files.base import ContentFile
        saved_filename = fs.save(filename, ContentFile(pdf_buffer.read()))
        
        backend_url = "http://127.0.0.1:8000"
        url = f"{backend_url}{settings.MEDIA_URL.rstrip('/')}/cronogramas/{saved_filename}"
        
        return {
            "role": "assistant",
            "content": f"✅ **PDF Generado Exitosamente:**\n\nHe creado el cronograma en formato PDF.\n\nHaz clic en el botón de abajo para descargarlo.",
            "actions": ["Descargar PDF"],
            "data": {"url": url, "filename": download_name}
        }
        
    raise AgenteServiceError("Acción no reconocida.")

def procesar_mensaje_agente(proyecto, mensaje_usuario: str) -> Dict[str, Any]:
    api_key = getattr(settings, "GEMINI_API_KEY", "")
    if not api_key:
        raise AgenteServiceError("GEMINI_API_KEY no configurada.")

    try:
        import google.generativeai as genai
    except ImportError:
        raise AgenteServiceError("google-generativeai no instalado.")

    genai.configure(api_key=api_key)

    # Las herramientas (funciones de python) que Gemini puede llamar
    tools = [optimizar_presupuesto, redisenar_plano, generar_cronograma, generar_cronograma_pdf]

    try:
        model = genai.GenerativeModel(
            model_name="models/gemini-2.5-flash", 
            tools=tools,
            system_instruction=(
                "Eres un Asistente IA Autónomo experto en construcción, diseño arquitectónico y presupuestos, llamado 'Asistente IA Autónomo'.\n"
                "Tu objetivo es ayudar al usuario a gestionar su proyecto, responder consultas técnicas, dar asesoría sobre mejores prácticas, evaluar calidad de planos y resolver dudas.\n"
                "Se te proporcionará el contexto del proyecto actual (nombre, plano, geometría, presupuesto). ÚSALO para dar respuestas ultra-personalizadas, detalladas y expertas.\n"
                "SIEMPRE debes estar dispuesto a responder cualquier consulta sobre arquitectura o construcción.\n"
                "ADEMÁS, posees herramientas (tools) para ejecutar acciones (optimizar presupuesto, rediseñar plano, generar cronograma, generar_cronograma_pdf). "
                "LLAMA a estas herramientas ÚNICAMENTE cuando el usuario te pida explícitamente ejecutar una de esas acciones (ej. 'optimiza el presupuesto', 'cambia a 4 dormitorios', 'genera el cronograma', 'genera el cronograma en pdf'). "
                "Si el usuario te pide exportar o descargar en PDF, llama a generar_cronograma_pdf. "
                "Si el usuario solo te pide tu opinión, consejo, o análisis, RESPONDRE NORMALMENTE con texto detallado y profesional en formato Markdown, sin llamar a ninguna herramienta."
            ),
            safety_settings=[
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ]
        )

        # Recopilar información del proyecto para inyectarla en el contexto
        contexto_detallado = []
        contexto_detallado.append(f"ID del Proyecto: {proyecto.id}")
        contexto_detallado.append(f"Nombre del Proyecto: {proyecto.titulo}")
        if proyecto.descripcion:
            contexto_detallado.append(f"Descripción: {proyecto.descripcion}")
            
        presupuesto = Presupuesto.objects.filter(proyecto=proyecto).first()
        if presupuesto:
            items = list(presupuesto.items.all()[:15]) # Tomar una muestra
            total_estimado = sum(float(i.cantidad) * float(i.precio_unitario) for i in items)
            contexto_detallado.append(f"Presupuesto Base detectado: {presupuesto.nombre} con total parcial de {total_estimado:.2f} Bs.")
            materiales = ", ".join([i.material.nombre for i in items])
            contexto_detallado.append(f"Materiales principales: {materiales}")
            
        plano = Plano.objects.filter(proyecto=proyecto).first()
        if plano and plano.datos_vectoriales:
            import json
            vectores = plano.datos_vectoriales
            muros = sum(1 for v in vectores if v.get('tipo') == 'muro')
            puertas = sum(1 for v in vectores if v.get('tipo') == 'puerta')
            textos = [v.get('texto') for v in vectores if v.get('tipo') == 'texto' and v.get('texto')]
            contexto_detallado.append(f"Plano Base detectado: {plano.nombre}")
            contexto_detallado.append(f"Geometría: {muros} muros, {puertas} puertas.")
            if textos:
                contexto_detallado.append(f"Habitaciones etiquetadas: {', '.join(textos)}")

        info_contexto_str = "\n".join(contexto_detallado)

        # Inyectamos el contexto de que estamos en este proyecto
        mensaje_contextualizado = f"""
[Contexto del Proyecto actual proporcionado por el sistema]
{info_contexto_str}

Solicitud del usuario: {mensaje_usuario}
"""
        response = model.generate_content(mensaje_contextualizado)

        if not response.candidates or not response.candidates[0].content.parts:
            finish_reason = "Desconocido"
            if response.candidates:
                finish_reason = getattr(response.candidates[0], "finish_reason", "Desconocido")
            elif hasattr(response, "prompt_feedback"):
                finish_reason = f"Prompt Blocked: {response.prompt_feedback}"
                
            logger.error(f"Gemini Empty Response. Reason: {finish_reason}")
            return {
                "role": "assistant",
                "content": f"Lo siento, mi motor de IA bloqueó temporalmente esta solicitud (Motivo: {finish_reason}). Intenta reformularla."
            }

        part = response.candidates[0].content.parts[0]
        
        # Si Gemini decidió llamar a una herramienta:
        if hasattr(part, "function_call") and part.function_call:
            fn = part.function_call
            if fn.name in TOOLS_MAP:
                args_dict = dict(fn.args)
                # Forzamos el proyecto_id si es necesario (por seguridad, ignoramos el de Gemini y usamos el real)
                args_dict["proyecto_id"] = proyecto.id
                
                try:
                    resultado = TOOLS_MAP[fn.name](**args_dict)
                    return {
                        "role": "assistant",
                        "content": resultado.get("mensaje", "He ejecutado la acción simulada."),
                        "actions": resultado.get("acciones", []),
                        "data": resultado
                    }
                except Exception as e:
                    logger.exception("Error ejecutando herramienta")
                    return {
                        "role": "assistant",
                        "content": f"Intenté ejecutar la acción pero ocurrió un error: {e}"
                    }
        
        # Si Gemini solo respondió con texto:
        return {
            "role": "assistant",
            "content": part.text or "No tengo respuesta textual para esto."
        }

    except Exception as e:
        logger.exception("Error en el agente IA")
        raise AgenteServiceError("Ocurrió un error al comunicarse con la IA.") from e
