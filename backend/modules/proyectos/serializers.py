from rest_framework import serializers

from .models import Proyecto


class ProyectoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proyecto
        fields = [
            "id",
            "idUsuario",
            "titulo",
            "descripcion",
            "num_pisos",
            "fechaCreacion",
        ]
        read_only_fields = ["id", "idUsuario", "fechaCreacion"]
