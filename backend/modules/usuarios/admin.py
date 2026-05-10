from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .forms import UsuarioChangeForm, UsuarioCreationForm
from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(DjangoUserAdmin):
    add_form = UsuarioCreationForm
    form = UsuarioChangeForm
    model = Usuario

    ordering = ("correo",)
    list_display = ("correo", "nombre", "apellido", "is_staff", "is_active")
    search_fields = ("correo", "nombre", "apellido")

    fieldsets = (
        (None, {"fields": ("correo", "password")}),
        ("Personal", {"fields": ("nombre", "apellido", "fechaNacimiento")}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Important dates", {"fields": ("last_login",)}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "correo",
                    "nombre",
                    "apellido",
                    "fechaNacimiento",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
    )

    filter_horizontal = ("groups", "user_permissions")
