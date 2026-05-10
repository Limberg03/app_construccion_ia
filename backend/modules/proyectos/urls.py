from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ProyectoViewSet

router = DefaultRouter()
router.include_format_suffixes = False
router.register(r"", ProyectoViewSet, basename="proyectos")

urlpatterns = [
    path("", include(router.urls)),
]
