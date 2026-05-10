from rest_framework import permissions, viewsets

from .models import Proyecto
from .serializers import ProyectoSerializer


class ProyectoViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Proyecto.objects.all().select_related("idUsuario").order_by("-id")
    serializer_class = ProyectoSerializer

    def get_queryset(self):
        return super().get_queryset().filter(idUsuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(idUsuario=self.request.user)
