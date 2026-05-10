from django.db import models


class Plano(models.Model):
    proyecto = models.ForeignKey(
        "proyectos.Proyecto",
        on_delete=models.CASCADE,
        related_name="planos",
    )
    nombre = models.CharField(max_length=200)
    archivo = models.FileField(upload_to="planos/", blank=True, null=True)

    # Importante: datos vectoriales (IA/OCR) como JSON
    datos_vectoriales = models.JSONField(default=dict, blank=True)
    modo_generacion = models.CharField(max_length=20, default="image", blank=True)
    prompt_usuario = models.TextField(blank=True)
    opciones_generacion = models.JSONField(default=dict, blank=True)
    escala_metros_por_pixel = models.DecimalField(max_digits=12, decimal_places=6, default=0.01)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"{self.proyecto_id} - {self.nombre}"


class Ambiente(models.Model):
    plano = models.ForeignKey(
        "planos.Plano",
        on_delete=models.CASCADE,
        related_name="ambientes",
    )
    nombre = models.CharField(max_length=200)
    tipo = models.CharField(max_length=100, blank=True)
    area_m2 = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Placeholder para datos geométricos del ambiente
    geometria = models.JSONField(default=dict, blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.plano_id} - {self.nombre}"
