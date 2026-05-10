import os
from datetime import timedelta
from pathlib import Path


import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env
# override=True: si existen variables en el sistema (aunque estén vacías),
# preferimos lo definido en el archivo .env del proyecto.
load_dotenv(BASE_DIR / ".env", override=True)

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "1").lower() in {"1", "true", "yes", "on"}

# Gemini
# Acepta GEMINI_API_KEY (preferido) y como fallback GOOGLE_API_KEY.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "").strip()
GEMINI_MODEL_FAST = os.getenv("GEMINI_MODEL_FAST", "").strip()
GEMINI_MODEL_STRONG = os.getenv("GEMINI_MODEL_STRONG", "").strip()

# OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4.1").strip()

# Selector de proveedor IA para procesar planos: gemini | openai
IA_PROVIDER = os.getenv("IA_PROVIDER", "gemini").strip().lower()

_allowed_hosts = os.getenv("DJANGO_ALLOWED_HOSTS", "")
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts.split(",") if h.strip()]

# Defaults razonables si no se configuró DJANGO_ALLOWED_HOSTS
if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = [
        "localhost",
        "127.0.0.1",
        "construccion-ia.onrender.com",
    ]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",
    "corsheaders",
    "rest_framework_simplejwt",

    # Local apps
    "modules.usuarios.apps.UsuariosConfig",
    "modules.proyectos.apps.ProyectosConfig",
    "modules.planos.apps.PlanosConfig",
    "modules.materiales.apps.MaterialesConfig",
    "modules.presupuestos.apps.PresupuestosConfig",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# Configuración de base de datos compatible con Render y local
DATABASES = {
    'default': dj_database_url.config(
        default=os.getenv('DATABASE_URL'),
        conn_max_age=600,
        ssl_require=True if os.getenv('RENDER', '').lower() == 'true' else False
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-bo"
TIME_ZONE = "America/La_Paz"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.AutoField"

# Custom user model (define BEFORE first migration)
AUTH_USER_MODEL = "usuarios.Usuario"

# DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# CORS
# Puedes extender/override con la variable de entorno `CORS_ALLOWED_ORIGINS`
# (lista separada por comas).
_cors_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
_cors_env_list = [o.strip() for o in _cors_env.split(",") if o.strip()]

_cors_defaults = [
    "https://construccion-ia.netlify.app",
    "https://TU-SITIO-AQUI.netlify.app",
    "http://localhost:5173",
]

# Preserva orden y evita duplicados
CORS_ALLOWED_ORIGINS = list(dict.fromkeys([*_cors_defaults, *_cors_env_list]))

# Si usas Authorization header o cookies en el frontend
CORS_ALLOW_CREDENTIALS = True

# Simple JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=7),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}
