from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BuscarPreciosMaterialesView, MaterialViewSet

router = DefaultRouter()
router.include_format_suffixes = False
router.register(r"", MaterialViewSet, basename="materiales")

urlpatterns = [
    path("precios/", BuscarPreciosMaterialesView.as_view(), name="materiales-precios"),
    path("", include(router.urls)),
]
