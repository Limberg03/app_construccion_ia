from django.contrib import admin

from .models import AuditoriaPresupuesto, Presupuesto, PresupuestoItem


class PresupuestoItemInline(admin.TabularInline):
    model = PresupuestoItem
    extra = 0


@admin.register(Presupuesto)
class PresupuestoAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre", "proyecto", "ambiente", "creado_en")
    search_fields = ("nombre", "proyecto__nombre")
    list_select_related = ("proyecto", "ambiente")
    inlines = [PresupuestoItemInline]


@admin.register(PresupuestoItem)
class PresupuestoItemAdmin(admin.ModelAdmin):
    list_display = ("id", "presupuesto", "material", "cantidad", "precio_unitario")
    list_select_related = ("presupuesto", "material")


@admin.register(AuditoriaPresupuesto)
class AuditoriaPresupuestoAdmin(admin.ModelAdmin):
    list_display = ("id", "presupuesto", "accion", "usuario", "creado_en")
    list_select_related = ("presupuesto", "usuario")
    search_fields = ("accion",)
