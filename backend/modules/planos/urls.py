from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AmbienteViewSet, PlanoViewSet

router = DefaultRouter()
router.include_format_suffixes = False
router.register(r"", PlanoViewSet, basename="planos")
router.register(r"ambientes", AmbienteViewSet, basename="ambientes")

urlpatterns = [
    path("", include(router.urls)),
]
