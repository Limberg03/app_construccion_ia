import logging
import json

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .services.gemini_service import GeminiServiceError, procesar_plano_con_gemini
from .services.chatbot_service import ChatbotServiceError, procesar_chatbot_plano
from .services.preview_service import generar_pack_previews
from .services.scale_service import infer_escala_metros_por_pixel
from .services.vector_postprocess import postprocess_vector_data
from django.conf import settings

from .models import Ambiente, Plano
from .serializers import AmbienteSerializer, PlanoSerializer
    

logger = logging.getLogger(__name__)


class PlanoViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Plano.objects.all().select_related("proyecto").order_by("-id")
    serializer_class = PlanoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.filter(proyecto__idUsuario=self.request.user)
        proyecto_id = self.request.query_params.get("proyecto")
        if proyecto_id:
            qs = qs.filter(proyecto_id=proyecto_id)
        return qs

    @action(
        detail=True,
        methods=["post"],
        url_path="procesar-ia",
        parser_classes=[MultiPartParser, FormParser],
    )
    def procesar_ia(self, request, pk=None):
        plano = self.get_object()

        modo = str(request.data.get("modo") or "image").strip().lower()
        if modo not in {"image", "text", "hybrid"}:
            return Response(
                {"detail": "El campo 'modo' debe ser: image, text o hybrid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prompt_usuario = str(request.data.get("prompt") or "").strip()

        # Punto 1: en modo image el prompt es estático (SYSTEM_PROMPT en backend).
        # Cualquier prompt enviado por el usuario se ignora para garantizar
        # consistencia en la interpretación de la imagen.
        if modo == "image":
            prompt_usuario = ""
        opciones_raw = request.data.get("opciones")
        opciones = {}
        if isinstance(opciones_raw, dict):
            opciones = opciones_raw
        elif isinstance(opciones_raw, str) and opciones_raw.strip():
            try:
                opciones = json.loads(opciones_raw)
            except json.JSONDecodeError:
                return Response(
                    {"detail": "El campo 'opciones' debe ser JSON válido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if modo == "text" and not prompt_usuario and not opciones:
            return Response(
                {"detail": "En modo text debes enviar prompt o opciones."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        upload = request.FILES.get("file") or request.FILES.get("image")
        if modo in {"image", "hybrid"} and not upload:
            return Response(
                {"detail": "Debes enviar un archivo en multipart/form-data con el campo 'file'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        escala_metros_por_pixel = request.data.get("escala_metros_por_pixel")
        if escala_metros_por_pixel not in (None, ""):
            try:
                escala_metros_por_pixel = float(escala_metros_por_pixel)
                if escala_metros_por_pixel <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                return Response(
                    {"detail": "'escala_metros_por_pixel' debe ser un número mayor a 0."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            img = None
            if upload:
                max_mb = 10
                if getattr(upload, "size", 0) and upload.size > max_mb * 1024 * 1024:
                    return Response(
                        {"detail": f"La imagen es demasiado grande (máximo {max_mb}MB)."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    from PIL import Image
                except Exception:
                    import sys

                    hint = ""
                    if getattr(settings, "DEBUG", False):
                        hint = f" (python={sys.executable})"
                    return Response(
                        {
                            "detail": (
                                "Pillow no está instalado en el backend. "
                                "Instala dependencias con -r requirements.txt y ejecuta el backend con el .venv."
                                + hint
                            )
                        },
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

                img = Image.open(upload)
                # Corrige rotación por EXIF (muy común en fotos de celular)
                try:
                    from PIL import ImageEnhance, ImageOps

                    img = ImageOps.exif_transpose(img)
                except Exception:
                    pass

                img = img.convert("RGB")

                # Mejora contraste/nitidez para líneas finas del plano.
                try:
                    from PIL import ImageEnhance, ImageOps

                    img = ImageOps.autocontrast(img)
                    img = ImageEnhance.Sharpness(img).enhance(1.6)
                except Exception:
                    pass

                # Reducción segura para evitar inputs enormes.
                # Puedes subirlo por request con opciones.max_side_px (ej: 4096/6144) para más detalle.
                try:
                    max_side = int((opciones or {}).get("max_side_px") or 3072)
                except Exception:
                    max_side = 3072
                max_side = max(1024, min(8192, max_side))
                if max(img.size) > max_side:
                    img.thumbnail((max_side, max_side))

            provider = str(getattr(settings, "IA_PROVIDER", "gemini") or "gemini").lower()
            if provider == "openai":
                from .services.openai_service import procesar_plano_con_openai

                result = procesar_plano_con_openai(
                    image_pil=img,
                    prompt_usuario=prompt_usuario,
                    opciones=opciones,
                    modo=modo,
                )
            else:
                result = procesar_plano_con_gemini(
                    image_pil=img,
                    prompt_usuario=prompt_usuario,
                    opciones=opciones,
                    modo=modo,
                )
            processed_vector_data, _stats = postprocess_vector_data(result.vector_data)
            plano.datos_vectoriales = processed_vector_data

            inferred_scale = None
            if escala_metros_por_pixel in (None, ""):
                inferred_scale = infer_escala_metros_por_pixel(plano.datos_vectoriales)
                if inferred_scale is not None:
                    escala_metros_por_pixel = float(inferred_scale.metros_por_pixel)

            update_fields = [
                "datos_vectoriales",
                "modo_generacion",
                "prompt_usuario",
                "opciones_generacion",
                "actualizado_en",
            ]
            plano.modo_generacion = modo
            plano.prompt_usuario = prompt_usuario
            plano.opciones_generacion = opciones
            if escala_metros_por_pixel not in (None, ""):
                plano.escala_metros_por_pixel = escala_metros_por_pixel
                update_fields.append("escala_metros_por_pixel")

            plano.save(update_fields=update_fields)

            previews = None
            try:
                previews = generar_pack_previews(plano.datos_vectoriales, opciones)
            except Exception:  # noqa: BLE001
                logger.exception("No se pudieron generar previews del plano")

            return Response(
                {
                    "vector_data": plano.datos_vectoriales,
                    "previews": previews,
                    "escala_metros_por_pixel": float(plano.escala_metros_por_pixel),
                },
                status=status.HTTP_200_OK,
            )

        except GeminiServiceError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.exception("Fallo procesando plano por IA")
            if getattr(settings, "DEBUG", False):
                return Response(
                    {"detail": f"Error inesperado procesando la imagen. ({type(e).__name__}: {e})"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            return Response(
                {"detail": "Error inesperado procesando la imagen."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="chatbot")
    def chatbot(self, request, pk=None):
        """Chatbot para editar el plano con lenguaje natural."""
        plano = self.get_object()

        mensaje = str(request.data.get("message") or "").strip()
        if not mensaje:
            return Response(
                {"detail": "El campo 'message' es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        shapes = request.data.get("shapes")
        if shapes is None:
            shapes = plano.datos_vectoriales if isinstance(plano.datos_vectoriales, list) else []

        if not isinstance(shapes, list):
            return Response(
                {"detail": "El campo 'shapes' debe ser una lista."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        history = request.data.get("history") or []
        selected_id = request.data.get("selected_id")

        try:
            parsed = procesar_chatbot_plano(
                message=mensaje,
                shapes=shapes,
                selected_id=selected_id,
                history=history,
            )
        except ChatbotServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(parsed, status=status.HTTP_200_OK)


    # ──────────────────────────────────────────────────────────────────────────
    # Punto 1 — Endpoint dedicado: analizar imagen sin prompt del usuario
    # Recibe únicamente la imagen; el prompt es 100% estático en el backend.
    # El frontend no necesita enviar ningún texto libre.
    # ──────────────────────────────────────────────────────────────────────────
    @action(
        detail=True,
        methods=["post"],
        url_path="analizar-imagen",
        parser_classes=[MultiPartParser, FormParser],
    )
    def analizar_imagen(self, request, pk=None):
        """Analiza una imagen de plano con prompt 100% estático. Sin input del usuario."""
        plano = self.get_object()

        upload = request.FILES.get("file") or request.FILES.get("image")
        if not upload:
            return Response(
                {"detail": "Debes enviar la imagen del plano en el campo 'file'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_mb = 10
        if getattr(upload, "size", 0) and upload.size > max_mb * 1024 * 1024:
            return Response(
                {"detail": f"La imagen es demasiado grande (máximo {max_mb}MB)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from PIL import Image, ImageEnhance, ImageOps
        except Exception:
            return Response(
                {"detail": "Pillow no está instalado en el backend."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            img = Image.open(upload)
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")
            img = ImageOps.autocontrast(img)
            img = ImageEnhance.Sharpness(img).enhance(1.6)
            if max(img.size) > 3072:
                img.thumbnail((3072, 3072))

            # Llama a la función dedicada del Punto 1 (prompt estático, sin usuario)
            # El usuario ha solicitado forzar el uso de OpenAI para esto.
            from .services.openai_service import procesar_plano_con_openai
            result = procesar_plano_con_openai(
                image_pil=img,
                prompt_usuario="",
                opciones={},
                modo="image"
            )

            from .services.vector_postprocess import postprocess_vector_data
            processed, _stats = postprocess_vector_data(result.vector_data)

            from .services.scale_service import infer_escala_metros_por_pixel
            inferred = infer_escala_metros_por_pixel(processed)
            escala = float(inferred.metros_por_pixel) if inferred else None

            plano.datos_vectoriales = processed
            plano.modo_generacion = "image"
            plano.prompt_usuario = ""  # sin prompt de usuario
            plano.opciones_generacion = {}
            update_fields = ["datos_vectoriales", "modo_generacion", "prompt_usuario", "opciones_generacion", "actualizado_en"]
            if escala is not None:
                plano.escala_metros_por_pixel = escala
                update_fields.append("escala_metros_por_pixel")
            plano.save(update_fields=update_fields)

            previews = None
            try:
                previews = generar_pack_previews(processed, {})
            except Exception:
                logger.exception("No se pudieron generar previews del plano")

            return Response(
                {
                    "vector_data": processed,
                    "previews": previews,
                    "escala_metros_por_pixel": escala,
                },
                status=status.HTTP_200_OK,
            )

        except GeminiServiceError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Fallo en analizar-imagen")
            if getattr(settings, "DEBUG", False):
                return Response(
                    {"detail": f"Error inesperado. ({type(e).__name__}: {e})"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            return Response(
                {"detail": "Error inesperado procesando la imagen."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class AmbienteViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Ambiente.objects.all().select_related("plano").order_by("id")
    serializer_class = AmbienteSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.filter(plano__proyecto__idUsuario=self.request.user)
        plano_id = self.request.query_params.get("plano")
        if plano_id:
            qs = qs.filter(plano_id=plano_id)
        return qs
