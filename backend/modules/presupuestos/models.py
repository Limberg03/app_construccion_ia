from django.conf import settings
from django.db import models
from django.db.models import DecimalField, ExpressionWrapper, F, Sum


class Presupuesto(models.Model):
    proyecto = models.ForeignKey(
        "proyectos.Proyecto",
        on_delete=models.CASCADE,
        related_name="presupuestos",
    )
    ambiente = models.ForeignKey(
        "planos.Ambiente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="presupuestos",
    )
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="presupuestos_creados",
    )

    nombre = models.CharField(max_length=200)
    notas = models.TextField(blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return self.nombre

    @property
    def total(self):
        calculo = ExpressionWrapper(
            F("cantidad") * F("precio_unitario"),
            output_field=DecimalField(max_digits=16, decimal_places=2),
        )
        return self.items.aggregate(total=Sum(calculo)).get("total") or 0

    @property
    def total_items(self):
        return self.items.count()


class PresupuestoItem(models.Model):
    presupuesto = models.ForeignKey(
        "presupuestos.Presupuesto",
        on_delete=models.CASCADE,
        related_name="items",
    )
    material = models.ForeignKey(
        "materiales.Material",
        on_delete=models.PROTECT,
        related_name="items_presupuesto",
    )

    cantidad = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    @property
    def subtotal(self):
        return self.cantidad * self.precio_unitario

    def __str__(self):
        return f"{self.presupuesto_id} - {self.material_id}"


class AuditoriaPresupuesto(models.Model):
    presupuesto = models.ForeignKey(
        "presupuestos.Presupuesto",
        on_delete=models.CASCADE,
        related_name="auditoria",
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="auditorias_presupuesto",
    )

    accion = models.CharField(max_length=60)
    payload = models.JSONField(default=dict, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"{self.presupuesto_id} - {self.accion}"
