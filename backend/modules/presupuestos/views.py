from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import AuditoriaPresupuesto, Presupuesto, PresupuestoItem
from .services.estimacion_service import generar_items_presupuesto
from .services.pdf_service import generar_pdf_presupuesto
from .serializers import (
    AuditoriaPresupuestoSerializer,
    PresupuestoItemSerializer,
    PresupuestoSerializer,
)


class PresupuestoViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Presupuesto.objects.all().select_related("proyecto", "ambiente", "creado_por").order_by("-id")
    serializer_class = PresupuestoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.filter(proyecto__idUsuario=self.request.user)
        proyecto_id = self.request.query_params.get("proyecto")
        if proyecto_id:
            qs = qs.filter(proyecto_id=proyecto_id)
        return qs

    @action(detail=True, methods=["post"], url_path="generar-automatico")
    def generar_automatico(self, request, pk=None):
        presupuesto = self.get_object()
        modo = str(request.data.get("modo") or "rapido").strip().lower()
        if modo not in {"rapido", "refinado", "hibrido"}:
            return Response(
                {"detail": "El campo 'modo' debe ser: rapido, refinado o hibrido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if modo == "hibrido":
            rapido = generar_items_presupuesto(presupuesto, modo="rapido", limpiar_existente=True)
            refinado = generar_items_presupuesto(presupuesto, modo="refinado", limpiar_existente=True)
            resumen = {
                "modo": "hibrido",
                "rapido": rapido,
                "refinado": refinado,
            }
        else:
            resumen = generar_items_presupuesto(presupuesto, modo=modo, limpiar_existente=True)

        AuditoriaPresupuesto.objects.create(
            presupuesto=presupuesto,
            usuario=request.user,
            accion="generar_automatico",
            payload=resumen,
        )

        payload = {
            "presupuesto": self.get_serializer(presupuesto).data,
            "items": PresupuestoItemSerializer(presupuesto.items.all(), many=True).data,
            "resumen": resumen,
        }
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="refinar-desde-plano")
    def refinar_desde_plano(self, request, pk=None):
        presupuesto = self.get_object()
        resumen = generar_items_presupuesto(presupuesto, modo="refinado", limpiar_existente=True)

        AuditoriaPresupuesto.objects.create(
            presupuesto=presupuesto,
            usuario=request.user,
            accion="refinar_desde_plano",
            payload=resumen,
        )

        payload = {
            "presupuesto": self.get_serializer(presupuesto).data,
            "items": PresupuestoItemSerializer(presupuesto.items.all(), many=True).data,
            "resumen": resumen,
        }
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="total")
    def total(self, request, pk=None):
        presupuesto = self.get_object()
        return Response(
            {
                "id": presupuesto.id,
                "total": presupuesto.total,
                "total_items": presupuesto.total_items,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="exportar-pdf")
    def exportar_pdf(self, request, pk=None):
        presupuesto = self.get_object()
        pdf_buffer = generar_pdf_presupuesto(presupuesto)
        
        response = HttpResponse(pdf_buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Presupuesto_{presupuesto.id}.pdf"'
        return response

    @action(detail=True, methods=["get"], url_path="items")
    def obtener_items(self, request, pk=None):
        presupuesto = self.get_object()
        items = presupuesto.items.all().select_related("material").order_by("id")
        serializer = PresupuestoItemSerializer(items, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PresupuestoItemViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = PresupuestoItem.objects.all().select_related("presupuesto", "material").order_by("id")
    serializer_class = PresupuestoItemSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.filter(presupuesto__proyecto__idUsuario=self.request.user)
        presupuesto_id = self.request.query_params.get("presupuesto")
        if presupuesto_id:
            qs = qs.filter(presupuesto_id=presupuesto_id)
        return qs


class AuditoriaPresupuestoViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = AuditoriaPresupuesto.objects.all().select_related("presupuesto", "usuario").order_by("-id")
    serializer_class = AuditoriaPresupuestoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.filter(presupuesto__proyecto__idUsuario=self.request.user)
        presupuesto_id = self.request.query_params.get("presupuesto")
        if presupuesto_id:
            qs = qs.filter(presupuesto_id=presupuesto_id)
        return qs
