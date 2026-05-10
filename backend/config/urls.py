from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),

    # API
    path("api/auth/", include("modules.usuarios.urls")),
    path("api/proyectos/", include("modules.proyectos.urls")),
    path("api/planos/", include("modules.planos.urls")),
    path("api/materiales/", include("modules.materiales.urls")),
    path("api/presupuestos/", include("modules.presupuestos.urls")),
]
