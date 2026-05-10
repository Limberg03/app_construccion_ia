from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Material
from .serializers import MaterialSerializer


class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.all().order_by("nombre")
    serializer_class = MaterialSerializer


class BuscarPreciosMaterialesView(APIView):
    permission_classes = [AllowAny]

    @staticmethod
    def _to_bool(valor, default=False):
        if valor is None:
            return default
        if isinstance(valor, bool):
            return valor
        return str(valor).strip().lower() in {"1", "true", "si", "sí", "yes", "on"}

    def post(self, request):
        materiales = request.data.get("materiales", [])
        if not isinstance(materiales, list):
            return Response(
                {"error": "El campo 'materiales' debe ser una lista de strings."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not materiales:
            materiales = list(Material.objects.values_list("nombre", flat=True))
            if not materiales:
                return Response(
                    {"error": "No hay materiales registrados para consultar."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        forzar_scraping = self._to_bool(request.data.get("refresh"), default=False)
        if forzar_scraping and not request.user.is_authenticated:
            return Response(
                {"error": "Debes estar autenticado para forzar scraping."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        max_age_hours = request.data.get("cache_horas", 168)
        try:
            max_age_hours = max(1, int(max_age_hours))
        except (TypeError, ValueError):
            return Response(
                {"error": "El campo 'cache_horas' debe ser un entero mayor a 0."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from materials.services.scraper_service import buscar_precios
        except ModuleNotFoundError as exc:
            return Response(
                {
                    "error": "Dependencias de scraping no instaladas.",
                    "detalle": str(exc),
                    "accion": "Instala requirements.txt en tu entorno virtual.",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        resultados = buscar_precios(
            materiales,
            persistir=True,
            forzar_scraping=forzar_scraping,
            max_age_hours=max_age_hours,
            registrar_ejecucion=forzar_scraping,
        )
        return Response(
            {
                "resultados": resultados,
                "cache_horas": max_age_hours,
                "refresh": forzar_scraping,
            },
            status=status.HTTP_200_OK,
        )
