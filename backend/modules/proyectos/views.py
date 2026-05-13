from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Proyecto
from .serializers import ProyectoSerializer
from .services.agente_service import procesar_mensaje_agente, ejecutar_accion_agente, AgenteServiceError


class ProyectoViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Proyecto.objects.all().select_related("idUsuario").order_by("-id")
    serializer_class = ProyectoSerializer

    def get_queryset(self):
        return super().get_queryset().filter(idUsuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(idUsuario=self.request.user)

    @action(detail=True, methods=["post"], url_path="agente")
    def agente(self, request, pk=None):
        proyecto = self.get_object()
        mensaje = request.data.get("message", "").strip()
        if not mensaje:
            return Response({"error": "No se proporcionó mensaje."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            resultado = procesar_mensaje_agente(proyecto, mensaje)
            return Response(resultado, status=status.HTTP_200_OK)
        except AgenteServiceError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": "Error interno del servidor."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="agente/ejecutar")
    def agente_ejecutar(self, request, pk=None):
        proyecto = self.get_object()
        accion_tipo = request.data.get("accion_tipo")
        payload = request.data.get("payload", {})
        
        if not accion_tipo:
            return Response({"error": "No se proporcionó accion_tipo."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            resultado = ejecutar_accion_agente(proyecto, accion_tipo, payload)
            return Response(resultado, status=status.HTTP_200_OK)
        except AgenteServiceError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": "Error al ejecutar acción."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    @action(detail=True, methods=["get"], url_path="agente/cronograma-pdf", permission_classes=[permissions.IsAuthenticated])
    def agente_cronograma_pdf(self, request, pk=None):
        """Genera el cronograma PDF y lo devuelve como descarga directa."""
        import re, json
        import google.generativeai as genai
        from django.http import HttpResponse
        from django.conf import settings
        from .services.agente_service import AgenteServiceError
        from .services.pdf_cronograma import crear_pdf_cronograma
        from modules.presupuestos.models import Presupuesto
        from modules.planos.models import Plano

        proyecto = self.get_object()
        
        # Recopilar contexto
        presupuesto = Presupuesto.objects.filter(proyecto=proyecto).first()
        items_str = "No hay presupuesto."
        if presupuesto:
            items_str = ", ".join([i.material.nombre for i in presupuesto.items.all()[:12]])

        plano = Plano.objects.filter(proyecto=proyecto).first()
        geometria_str = "No hay plano disponible."
        if plano and plano.datos_vectoriales:
            vectores = plano.datos_vectoriales
            muros   = sum(1 for v in vectores if v.get('tipo') == 'muro')
            puertas = sum(1 for v in vectores if v.get('tipo') == 'puerta')
            textos  = [v.get('texto') for v in vectores if v.get('tipo') == 'texto' and v.get('texto')]
            geometria_str = f"{muros} muros, {puertas} puertas. Habitaciones: {', '.join(textos) if textos else 'no especificadas'}."

        try:
            api_key = getattr(settings, "GEMINI_API_KEY", "")
            genai.configure(api_key=api_key)

            prompt = f"""
            Eres un gerente de obras experto en Bolivia/Latinoamérica.
            Proyecto: '{proyecto.titulo}' — {proyecto.descripcion or ''}.
            Materiales detectados: {items_str}. Geometría: {geometria_str}.

            Genera un CRONOGRAMA DE EJECUCIÓN DE OBRA de 10 semanas en 4 fases.
            Devuelve SOLO JSON puro (sin bloques ```, sin texto extra) con esta estructura:
            {{
                "proyecto": "{proyecto.titulo}",
                "total_semanas": 10,
                "fases": [
                    {{
                        "numero": 1,
                        "titulo": "Fase 1: Obra Gruesa y Cimentación",
                        "semanas": [
                            {{
                                "semana": 1,
                                "titulo": "Semana 1: Preparación y Cimientos",
                                "critico": true,
                                "actividades": [
                                    {{"descripcion": "Limpieza del terreno", "materiales": "Herramientas manuales", "notas": ""}}
                                ]
                            }}
                        ]
                    }}
                ],
                "materiales_completos": [
                    {{"categoria": "Estructura", "items": ["Cemento", "Ladrillo", "Acero"]}}
                ],
                "riesgos_climaticos": [
                    {{"riesgo": "Lluvia", "impacto": "Alto", "mitigacion": "Lonas protectoras"}}
                ]
            }}
            Fases: Fase1=Semanas1-3(Obra Gruesa), Fase2=Semanas4-6(Curado/Revoques), Fase3=Semanas7-9(Acabados), Fase4=Semana10(Buffer).
            3-5 actividades por semana, materiales reales incluyendo pintura y cerámica aunque no estén en presupuesto.
            """

            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                safety_settings=[
                    {"category": "HARM_CATEGORY_HARASSMENT",       "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_HATE_SPEECH",       "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
                ]
            )
            response = model.generate_content(prompt)
            text = response.text

            # Limpiar markdown si viene
            match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
            if match:
                text = match.group(1)

            datos = json.loads(text)
            pdf_buffer = crear_pdf_cronograma(proyecto, datos)

            slug = re.sub(r'[^a-zA-Z0-9]', '_', proyecto.titulo.strip())[:30]
            filename = f"Cronograma_de_Obra_{slug}.pdf"

            resp = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            resp['Content-Disposition'] = f'attachment; filename="{filename}"'
            resp['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
            resp['Access-Control-Allow-Credentials'] = 'true'
            return resp

        except Exception as e:
            return Response({"error": f"Error al generar PDF: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
