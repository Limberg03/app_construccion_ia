from decimal import Decimal

from django.db import models
from django.utils import timezone


class Material(models.Model):
    nombre = models.CharField(max_length=200)
    categoria = models.CharField(max_length=120, blank=True)
    unidad = models.CharField(max_length=50, blank=True)
    precio_referencial = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    precio_actualizado_en = models.DateTimeField(null=True, blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre

    def actualizar_precio_desde_historial(self):
        """Calcula un precio referencial con el ultimo valor por fuente."""
        ultimos_por_fuente: dict[str, Decimal] = {}
        for registro in self.precios_scrapeados.order_by("-scrapeado_en"):
            if registro.fuente in ultimos_por_fuente:
                continue
            ultimos_por_fuente[registro.fuente] = registro.precio

        if not ultimos_por_fuente:
            return self.precio_referencial

        total = sum(ultimos_por_fuente.values(), Decimal("0"))
        promedio = (total / Decimal(len(ultimos_por_fuente))).quantize(Decimal("0.01"))
        self.precio_referencial = promedio
        self.precio_actualizado_en = timezone.now()
        self.save(update_fields=["precio_referencial", "precio_actualizado_en", "actualizado_en"])
        return self.precio_referencial


class PrecioMaterialScrapeado(models.Model):
    material = models.ForeignKey(
        "materiales.Material",
        on_delete=models.SET_NULL,
        related_name="precios_scrapeados",
        null=True,
        blank=True,
    )
    nombre_material = models.CharField(max_length=200, db_index=True)
    precio = models.DecimalField(max_digits=12, decimal_places=2)
    moneda = models.CharField(max_length=10, default="BOB")
    fuente = models.CharField(max_length=120)
    url_origen = models.URLField(blank=True)
    scrapeado_en = models.DateTimeField(default=timezone.now, db_index=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scrapeado_en", "nombre_material"]
        indexes = [
            models.Index(fields=["nombre_material", "-scrapeado_en"]),
            models.Index(fields=["fuente", "-scrapeado_en"]),
        ]

    def __str__(self):
        return f"{self.nombre_material} - {self.fuente} - {self.precio}"


class EjecucionScrapingMaterial(models.Model):
    ESTADO_EXITO = "success"
    ESTADO_PARCIAL = "partial"
    ESTADO_ERROR = "failed"
    ESTADOS = (
        (ESTADO_EXITO, "Exito"),
        (ESTADO_PARCIAL, "Parcial"),
        (ESTADO_ERROR, "Error"),
    )

    estado = models.CharField(max_length=20, choices=ESTADOS, default=ESTADO_EXITO)
    materiales_solicitados = models.JSONField(default=list, blank=True)
    materiales_procesados = models.IntegerField(default=0)
    precios_encontrados = models.IntegerField(default=0)
    precios_guardados = models.IntegerField(default=0)
    errores = models.JSONField(default=dict, blank=True)
    duracion_segundos = models.FloatField(default=0)

    iniciado_en = models.DateTimeField(auto_now_add=True)
    finalizado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-iniciado_en"]

    def __str__(self):
        return f"{self.iniciado_en:%Y-%m-%d %H:%M} - {self.estado}"
