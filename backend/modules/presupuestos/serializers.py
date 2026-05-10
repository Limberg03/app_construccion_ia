from rest_framework import serializers

from .models import AuditoriaPresupuesto, Presupuesto, PresupuestoItem


class PresupuestoSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    total_items = serializers.IntegerField(read_only=True)

    class Meta:
        model = Presupuesto
        fields = [
            "id",
            "proyecto",
            "ambiente",
            "creado_por",
            "nombre",
            "notas",
            "total",
            "total_items",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = ["id", "creado_en", "actualizado_en"]


class PresupuestoItemSerializer(serializers.ModelSerializer):
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    material_nombre = serializers.CharField(source='material.nombre', read_only=True)

    class Meta:
        model = PresupuestoItem
        fields = [
            "id",
            "presupuesto",
            "material",
            "material_nombre",
            "cantidad",
            "precio_unitario",
            "subtotal",
            "creado_en",
        ]
        read_only_fields = ["id", "subtotal", "creado_en"]


class AuditoriaPresupuestoSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditoriaPresupuesto
        fields = [
            "id",
            "presupuesto",
            "usuario",
            "accion",
            "payload",
            "creado_en",
        ]
        read_only_fields = ["id", "creado_en"]
