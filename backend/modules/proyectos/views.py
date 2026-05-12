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
