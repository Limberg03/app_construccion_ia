from django.core.management.base import BaseCommand, CommandError

from materials.services.scraper_service import buscar_precios, sincronizar_catalogo_insucons
from modules.materiales.models import Material


class Command(BaseCommand):
    help = "Refresca precios de materiales usando cache y scraping."

    def add_arguments(self, parser):
        parser.add_argument(
            "--materiales",
            nargs="*",
            type=str,
            help="Lista de materiales a procesar. Si se omite, usa todos los materiales del catalogo.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Fuerza scraping aunque exista cache reciente.",
        )
        parser.add_argument(
            "--cache-horas",
            type=int,
            default=168,
            help="Horas de vigencia de cache antes de volver a scrapear.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="No guarda en base de datos, solo muestra resultados.",
        )
        parser.add_argument(
            "--insucons-todo",
            action="store_true",
            help="Descarga TODO el catalogo de Insucons y lo persiste en la BD.",
        )
        parser.add_argument(
            "--timeout",
            type=int,
            default=12,
            help="Timeout en segundos para peticiones HTTP del scraping.",
        )

    def handle(self, *args, **options):
        insucons_todo = bool(options.get("insucons_todo"))
        forzar = bool(options.get("force"))
        dry_run = bool(options.get("dry_run"))
        timeout = max(5, int(options.get("timeout") or 12))

        if insucons_todo:
            self.stdout.write(self.style.WARNING("Sincronizando catalogo completo de Insucons..."))
            resumen = sincronizar_catalogo_insucons(
                persistir=not dry_run,
                timeout=timeout,
                registrar_ejecucion=True,
                force_refresh=forzar,
            )
            if not resumen.get("ok"):
                raise CommandError(f"Fallo sincronizacion Insucons: {resumen.get('detalle')}")

            self.stdout.write(self.style.SUCCESS(f"Materiales de catalogo: {resumen.get('materiales_catalogo')}"))
            self.stdout.write(self.style.SUCCESS(f"Filas de catalogo: {resumen.get('filas_catalogo')}"))
            self.stdout.write(self.style.SUCCESS(f"Precios encontrados: {resumen.get('precios_encontrados')}"))
            self.stdout.write(self.style.SUCCESS(f"Precios guardados: {resumen.get('precios_guardados')}"))
            self.stdout.write(self.style.SUCCESS(f"Duracion (s): {resumen.get('duracion_segundos')}"))
            return

        materiales = options.get("materiales") or []
        if not materiales:
            materiales = list(Material.objects.values_list("nombre", flat=True))

        materiales = [m.strip() for m in materiales if isinstance(m, str) and m.strip()]
        if not materiales:
            self.stdout.write(self.style.WARNING("No hay materiales para procesar."))
            return

        cache_horas = max(1, int(options.get("cache_horas") or 168))

        self.stdout.write(
            self.style.WARNING(
                f"Procesando {len(materiales)} materiales | force={forzar} | dry_run={dry_run} | cache_horas={cache_horas}"
            )
        )

        resultados = buscar_precios(
            materiales,
            persistir=not dry_run,
            forzar_scraping=forzar,
            max_age_hours=cache_horas,
            registrar_ejecucion=True,
        )

        total_registros = sum(len(lista) for lista in resultados.values())
        self.stdout.write(self.style.SUCCESS(f"Materiales consultados: {len(resultados)}"))
        self.stdout.write(self.style.SUCCESS(f"Precios devueltos: {total_registros}"))

        if dry_run:
            # Vista compacta para validar sin escribir en BD.
            for nombre, lista in resultados.items():
                if not lista:
                    continue
                mejor = lista[0]
                self.stdout.write(
                    f"- {nombre}: {mejor.get('precio')} {mejor.get('moneda')} ({mejor.get('fuente')})"
                )
