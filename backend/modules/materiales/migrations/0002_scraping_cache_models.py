# Generated manually for scraping cache and execution logs.

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materiales", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="material",
            name="precio_actualizado_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="EjecucionScrapingMaterial",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "estado",
                    models.CharField(
                        choices=[("success", "Exito"), ("partial", "Parcial"), ("failed", "Error")],
                        default="success",
                        max_length=20,
                    ),
                ),
                ("materiales_solicitados", models.JSONField(blank=True, default=list)),
                ("materiales_procesados", models.IntegerField(default=0)),
                ("precios_encontrados", models.IntegerField(default=0)),
                ("precios_guardados", models.IntegerField(default=0)),
                ("errores", models.JSONField(blank=True, default=dict)),
                ("duracion_segundos", models.FloatField(default=0)),
                ("iniciado_en", models.DateTimeField(auto_now_add=True)),
                ("finalizado_en", models.DateTimeField(blank=True, null=True)),
            ],
            options={"ordering": ["-iniciado_en"]},
        ),
        migrations.CreateModel(
            name="PrecioMaterialScrapeado",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre_material", models.CharField(db_index=True, max_length=200)),
                ("precio", models.DecimalField(decimal_places=2, max_digits=12)),
                ("moneda", models.CharField(default="BOB", max_length=10)),
                ("fuente", models.CharField(max_length=120)),
                ("url_origen", models.URLField(blank=True)),
                ("scrapeado_en", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "material",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="precios_scrapeados",
                        to="materiales.material",
                    ),
                ),
            ],
            options={"ordering": ["-scrapeado_en", "nombre_material"]},
        ),
        migrations.AddIndex(
            model_name="preciomaterialscrapeado",
            index=models.Index(fields=["nombre_material", "-scrapeado_en"], name="materiales_p_nombre__5cb722_idx"),
        ),
        migrations.AddIndex(
            model_name="preciomaterialscrapeado",
            index=models.Index(fields=["fuente", "-scrapeado_en"], name="materiales_p_fuente_9f99c7_idx"),
        ),
    ]
