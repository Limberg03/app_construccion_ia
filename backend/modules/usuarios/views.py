from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import LoginSerializer, RegistroSerializer


class AuthViewSet(viewsets.ViewSet):
    def get_permissions(self):
        if self.action == "register":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def register(self, request):
        serializer = RegistroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        return Response(
            {
                "id": usuario.id,
                "nombre": usuario.nombre,
                "apellido": usuario.apellido,
                "correo": usuario.correo,
                "fechaNacimiento": usuario.fechaNacimiento,
            },
            status=status.HTTP_201_CREATED,
        )

    def me(self, request):
        u = request.user
        return Response(
            {
                "id": getattr(u, "id", None),
                "nombre": getattr(u, "nombre", ""),
                "apellido": getattr(u, "apellido", ""),
                "correo": getattr(u, "correo", ""),
                "fechaNacimiento": getattr(u, "fechaNacimiento", None),
            }
        )


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer
