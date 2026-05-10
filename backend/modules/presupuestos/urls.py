from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AuditoriaPresupuestoViewSet, PresupuestoItemViewSet, PresupuestoViewSet

router = DefaultRouter()
router.include_format_suffixes = False
router.register(r"", PresupuestoViewSet, basename="presupuestos")
router.register(r"items", PresupuestoItemViewSet, basename="presupuesto-items")
router.register(r"auditoria", AuditoriaPresupuestoViewSet, basename="auditoria-presupuesto")

urlpatterns = [
    path("", include(router.urls)),
]
