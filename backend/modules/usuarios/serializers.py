from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Usuario


class RegistroSerializer(serializers.ModelSerializer):
    # Se valida longitud minima para una contrasena segura basica.
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = Usuario
        fields = [
            "id",
            "nombre",
            "apellido",
            "correo",
            "password",
            "fechaNacimiento",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {
            "nombre": {"required": True, "allow_blank": False},
            "apellido": {"required": True, "allow_blank": False},
            "correo": {"required": True, "allow_blank": False},
        }

    def validate_nombre(self, value):
        if not value.strip():
            raise serializers.ValidationError("El nombre es obligatorio.")
        return value.strip()

    def validate_apellido(self, value):
        if not value.strip():
            raise serializers.ValidationError("El apellido es obligatorio.")
        return value.strip()

    def validate_correo(self, value):
        correo = value.strip().lower()
        if Usuario.objects.filter(correo=correo).exists():
            raise serializers.ValidationError("Este correo ya esta registrado.")
        return correo

    def create(self, validated_data):
        password = validated_data.pop("password")
        usuario = Usuario(**validated_data)
        usuario.set_password(password)
        usuario.save()
        return usuario


class LoginSerializer(TokenObtainPairSerializer):
    username_field = "correo"
