from rest_framework import serializers

from .models import Ambiente, Plano


class PlanoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plano
        fields = [
            "id",
            "proyecto",
            "nombre",
            "archivo",
            "datos_vectoriales",
            "modo_generacion",
            "prompt_usuario",
            "opciones_generacion",
            "escala_metros_por_pixel",
            "es_alternativa",
            "plano_original",
            "costo_estimado",
            "tiempo_estimado_dias",
            "co2_estimado",
            "puntuacion_sostenibilidad",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = ["id", "creado_en", "actualizado_en"]


class AmbienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ambiente
        fields = [
            "id",
            "plano",
            "nombre",
            "tipo",
            "area_m2",
            "geometria",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = ["id", "creado_en", "actualizado_en"]
