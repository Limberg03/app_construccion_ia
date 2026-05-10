from pathlib import Path

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Prueba rápida de OpenAI Vision con una imagen local y muestra el error/resultado."

    def add_arguments(self, parser):
        parser.add_argument(
            "--image",
            type=str,
            required=True,
            help="Ruta a una imagen (png/jpg) para enviar al modelo.",
        )

    def handle(self, *args, **options):
        image_path = Path(options["image"]).expanduser().resolve()
        if not image_path.exists():
            raise CommandError(f"No existe la imagen: {image_path}")

        try:
            from PIL import Image
        except Exception as e:
            raise CommandError("Pillow no está instalado en este entorno.") from e

        from modules.planos.services.openai_service import procesar_plano_con_openai

        img = Image.open(str(image_path)).convert("RGB")

        result = procesar_plano_con_openai(image_pil=img)
        self.stdout.write(self.style.SUCCESS("OK"))
        self.stdout.write(f"items={len(result.vector_data)}")
        self.stdout.write(result.raw_text[:800])
