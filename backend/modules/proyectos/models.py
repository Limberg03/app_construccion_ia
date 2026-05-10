from django.conf import settings
from django.db import models


class Proyecto(models.Model):
    idUsuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="proyectos",
        db_column="idUsuario",
    )
    titulo = models.CharField(max_length=100)
    descripcion = models.CharField(max_length=250)
    num_pisos = models.PositiveSmallIntegerField(default=1, help_text="Número de pisos de la construcción")
    fechaCreacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return self.titulo
