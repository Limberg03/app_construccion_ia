# Generated manually for IA generation metadata.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("planos", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="plano",
            name="escala_metros_por_pixel",
            field=models.DecimalField(decimal_places=6, default=0.01, max_digits=12),
        ),
        migrations.AddField(
            model_name="plano",
            name="modo_generacion",
            field=models.CharField(blank=True, default="image", max_length=20),
        ),
        migrations.AddField(
            model_name="plano",
            name="opciones_generacion",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="plano",
            name="prompt_usuario",
            field=models.TextField(blank=True),
        ),
    ]
