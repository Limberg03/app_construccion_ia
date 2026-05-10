from django.contrib import admin

from .models import Ambiente, Plano


@admin.register(Plano)
class PlanoAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre", "proyecto", "creado_en")
    search_fields = ("nombre", "proyecto__nombre")
    list_select_related = ("proyecto",)


@admin.register(Ambiente)
class AmbienteAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre", "tipo", "plano")
    search_fields = ("nombre", "tipo", "plano__nombre")
    list_select_related = ("plano",)
