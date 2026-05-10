from rest_framework import serializers

from .models import Material


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = [
            "id",
            "nombre",
            "categoria",
            "unidad",
            "precio_referencial",
            "precio_actualizado_en",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = ["id", "creado_en", "actualizado_en"]
