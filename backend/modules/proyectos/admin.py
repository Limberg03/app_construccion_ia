from django.contrib import admin

from .models import Proyecto


@admin.register(Proyecto)
class ProyectoAdmin(admin.ModelAdmin):
    list_display = ("id", "titulo", "idUsuario", "fechaCreacion")
    search_fields = ("titulo", "descripcion", "idUsuario__correo")
    list_select_related = ("idUsuario",)
