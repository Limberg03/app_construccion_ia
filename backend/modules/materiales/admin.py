from django.contrib import admin

from .models import EjecucionScrapingMaterial, Material, PrecioMaterialScrapeado


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre", "categoria", "unidad", "precio_referencial", "precio_actualizado_en")
    search_fields = ("nombre", "categoria")


@admin.register(PrecioMaterialScrapeado)
class PrecioMaterialScrapeadoAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre_material", "precio", "moneda", "fuente", "scrapeado_en")
    search_fields = ("nombre_material", "fuente")
    list_filter = ("fuente", "moneda")
    list_select_related = ("material",)


@admin.register(EjecucionScrapingMaterial)
class EjecucionScrapingMaterialAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "estado",
        "materiales_procesados",
        "precios_encontrados",
        "precios_guardados",
        "duracion_segundos",
        "iniciado_en",
    )
    list_filter = ("estado",)
