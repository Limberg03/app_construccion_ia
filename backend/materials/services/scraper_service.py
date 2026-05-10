import logging
import os
import time
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from collections.abc import Callable

from django.db import transaction
from django.utils import timezone

from materials.services.utils.normalizer import normalizar_material
from modules.materiales.models import EjecucionScrapingMaterial, Material, PrecioMaterialScrapeado

logger = logging.getLogger(__name__)

DELAY_ENTRE_REQUESTS = float(os.getenv("SCRAPER_DELAY_SECONDS", "0.3"))
TIMEOUT_REQUEST = int(os.getenv("SCRAPER_TIMEOUT_SECONDS", "12"))
CACHE_HORAS_DEFECTO = int(os.getenv("SCRAPER_CACHE_HOURS", "168"))
DEDUPE_SEGUNDOS = int(os.getenv("SCRAPER_DEDUPE_SECONDS", "86400"))


def _obtener_scrapers() -> tuple[Callable[[str, int], list[dict]], ...]:
    # Import diferido para no bloquear el arranque de Django si falta requests/bs4.
    from materials.services.scrapers.scraper_ejemplo1 import scraper_ejemplo1
    from materials.services.scrapers.scraper_insucons import scraper_insucons
    from materials.services.scrapers.scraper_constructorbolivia import scraper_constructorbolivia
    from materials.services.scrapers.scraper_ferrocenter import scraper_ferrocenter

    return (scraper_ejemplo1, scraper_insucons, scraper_constructorbolivia, scraper_ferrocenter)


def _normalizar_lista_materiales(materiales: list[str]) -> list[str]:
    salida: list[str] = []
    vistos: set[str] = set()
    for material in materiales:
        if not isinstance(material, str) or not material.strip():
            logger.warning("Material invalido omitido: %s", material)
            continue
        nombre_material = normalizar_material(material)
        if nombre_material in vistos:
            continue
        vistos.add(nombre_material)
        salida.append(nombre_material)
    return salida


def _obtener_cache_precios(materiales: list[str], max_age_hours: int) -> dict[str, list[dict]]:
    if not materiales:
        return {}

    max_age_hours = max(1, int(max_age_hours))
    umbral = timezone.now() - timedelta(hours=max_age_hours)
    registros = (
        PrecioMaterialScrapeado.objects.filter(
            nombre_material__in=materiales,
            scrapeado_en__gte=umbral,
        )
        .order_by("nombre_material", "fuente", "-scrapeado_en")
    )

    cache: dict[str, list[dict]] = {material: [] for material in materiales}
    vistos: set[tuple[str, str]] = set()
    for registro in registros:
        llave = (registro.nombre_material, registro.fuente)
        if llave in vistos:
            continue
        vistos.add(llave)
        cache.setdefault(registro.nombre_material, []).append(
            {
                "precio": float(registro.precio),
                "moneda": registro.moneda,
                "fuente": registro.fuente,
            }
        )

    for material, lista in cache.items():
        lista.sort(key=lambda item: item.get("precio", 0))
        cache[material] = lista

    return cache


def _scrapear_materiales(materiales: list[str]) -> tuple[dict[str, list[dict]], dict[str, list[str]]]:
    resultados_por_material: dict[str, list[dict]] = {material: [] for material in materiales}
    errores: dict[str, list[str]] = {}
    scrapers = _obtener_scrapers()

    for material in materiales:
        for scraper in scrapers:
            try:
                resultados = scraper(material, TIMEOUT_REQUEST)
                resultados_por_material[material].extend(resultados)
            except Exception as exc:  # noqa: BLE001
                mensaje = f"{scraper.__name__}: {exc}"
                errores.setdefault(material, []).append(mensaje)
                logger.exception(
                    "Error en scraper %s para %s: %s",
                    scraper.__name__,
                    material,
                    exc,
                )

            if DELAY_ENTRE_REQUESTS > 0:
                time.sleep(DELAY_ENTRE_REQUESTS)

    for material, lista in resultados_por_material.items():
        lista.sort(key=lambda item: item.get("precio", 0))

    return resultados_por_material, errores


def _parse_precio(valor: object) -> Decimal | None:
    try:
        return Decimal(str(valor)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _guardar_resultados_scrapeados(resultados: dict[str, list[dict]]) -> tuple[int, int]:
    precios_encontrados = 0
    precios_guardados = 0
    ahora = timezone.now()

    with transaction.atomic():
        for nombre_material, lista in resultados.items():
            if not lista:
                continue

            material_obj, _ = Material.objects.get_or_create(nombre=nombre_material)

            for item in lista:
                precio = _parse_precio(item.get("precio"))
                if precio is None:
                    continue
                precios_encontrados += 1

                fuente = str(item.get("fuente") or "desconocida").strip()[:120]
                moneda = str(item.get("moneda") or "BOB").strip()[:10]

                ultimo = (
                    PrecioMaterialScrapeado.objects.filter(
                        nombre_material=nombre_material,
                        fuente=fuente,
                    )
                    .order_by("-scrapeado_en")
                    .first()
                )
                if (
                    ultimo
                    and ultimo.precio == precio
                    and (ahora - ultimo.scrapeado_en).total_seconds() < DEDUPE_SEGUNDOS
                ):
                    continue

                PrecioMaterialScrapeado.objects.create(
                    material=material_obj,
                    nombre_material=nombre_material,
                    precio=precio,
                    moneda=moneda,
                    fuente=fuente,
                    url_origen=str(item.get("url") or "")[:500],
                    scrapeado_en=ahora,
                )
                precios_guardados += 1

            material_obj.actualizar_precio_desde_historial()

    return precios_encontrados, precios_guardados


def _registrar_ejecucion(
    *,
    estado: str,
    materiales: list[str],
    procesados: int,
    precios_encontrados: int,
    precios_guardados: int,
    errores: dict[str, list[str]],
    duracion_segundos: float,
):
    EjecucionScrapingMaterial.objects.create(
        estado=estado,
        materiales_solicitados=materiales,
        materiales_procesados=procesados,
        precios_encontrados=precios_encontrados,
        precios_guardados=precios_guardados,
        errores=errores,
        duracion_segundos=duracion_segundos,
        finalizado_en=timezone.now(),
    )


def buscar_precios(
    materiales: list[str],
    *,
    persistir: bool = False,
    forzar_scraping: bool = False,
    max_age_hours: int = CACHE_HORAS_DEFECTO,
    registrar_ejecucion: bool = False,
) -> dict[str, list[dict]]:
    """Busca precios con cache en BD y scraping solo para faltantes."""
    inicio = time.perf_counter()
    materiales_norm = _normalizar_lista_materiales(materiales)
    if not materiales_norm:
        return {}

    cache = {} if forzar_scraping else _obtener_cache_precios(materiales_norm, max_age_hours)
    pendientes = [m for m in materiales_norm if forzar_scraping or not cache.get(m)]

    resultados = {material: list(cache.get(material, [])) for material in materiales_norm}
    errores: dict[str, list[str]] = {}
    precios_encontrados = 0
    precios_guardados = 0

    if pendientes:
        scrapeados, errores = _scrapear_materiales(pendientes)
        for material, lista in scrapeados.items():
            if not lista:
                resultados.setdefault(material, [])
                continue

            # Fusiona cache + scrape evitando duplicados exactos por fuente/precio.
            vistos: set[tuple[str, str, float]] = set()
            combinados: list[dict] = []
            for item in [*resultados.get(material, []), *lista]:
                precio_float = float(item.get("precio", 0))
                llave = (
                    str(item.get("fuente") or "").strip().lower(),
                    str(item.get("moneda") or "").strip().upper(),
                    precio_float,
                )
                if llave in vistos:
                    continue
                vistos.add(llave)
                combinados.append(item)

            combinados.sort(key=lambda item: item.get("precio", 0))
            resultados[material] = combinados

        if persistir:
            precios_encontrados, precios_guardados = _guardar_resultados_scrapeados(scrapeados)

    if registrar_ejecucion:
        duracion = time.perf_counter() - inicio
        estado = EjecucionScrapingMaterial.ESTADO_EXITO
        if errores and precios_guardados == 0 and pendientes:
            estado = EjecucionScrapingMaterial.ESTADO_ERROR
        elif errores:
            estado = EjecucionScrapingMaterial.ESTADO_PARCIAL

        _registrar_ejecucion(
            estado=estado,
            materiales=materiales_norm,
            procesados=len(pendientes),
            precios_encontrados=precios_encontrados,
            precios_guardados=precios_guardados,
            errores=errores,
            duracion_segundos=duracion,
        )

    return resultados


def sincronizar_catalogo_insucons(
    *,
    persistir: bool = True,
    timeout: int | None = None,
    registrar_ejecucion: bool = True,
    force_refresh: bool = True,
) -> dict[str, object]:
    """Ingiere todo el catalogo de Insucons y actualiza precios en BD."""
    inicio = time.perf_counter()
    timeout = timeout or TIMEOUT_REQUEST
    errores: dict[str, list[str]] = {}

    try:
        from materials.services.scrapers.scraper_insucons import obtener_catalogo_insucons

        catalogo = obtener_catalogo_insucons(timeout=timeout, force_refresh=force_refresh)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Error cargando catalogo completo de Insucons")
        if registrar_ejecucion:
            _registrar_ejecucion(
                estado=EjecucionScrapingMaterial.ESTADO_ERROR,
                materiales=["__INSUCONS_CATALOGO_COMPLETO__"],
                procesados=0,
                precios_encontrados=0,
                precios_guardados=0,
                errores={"insucons": [str(exc)]},
                duracion_segundos=time.perf_counter() - inicio,
            )
        return {
            "ok": False,
            "detalle": str(exc),
            "materiales_catalogo": 0,
            "precios_encontrados": 0,
            "precios_guardados": 0,
        }

    if not catalogo:
        if registrar_ejecucion:
            _registrar_ejecucion(
                estado=EjecucionScrapingMaterial.ESTADO_ERROR,
                materiales=["__INSUCONS_CATALOGO_COMPLETO__"],
                procesados=0,
                precios_encontrados=0,
                precios_guardados=0,
                errores={"insucons": ["No se obtuvo catalogo"]},
                duracion_segundos=time.perf_counter() - inicio,
            )
        return {
            "ok": False,
            "detalle": "No se obtuvo catalogo de Insucons",
            "materiales_catalogo": 0,
            "precios_encontrados": 0,
            "precios_guardados": 0,
        }

    precios_encontrados = 0
    precios_guardados = 0
    materiales_tocados: dict[str, Material] = {}

    if persistir:
        ahora = timezone.now()
        with transaction.atomic():
            for item in catalogo:
                nombre_material = normalizar_material(
                    str(item.get("nombre_material") or item.get("descripcion") or "")
                )
                if not nombre_material:
                    continue

                unidad = str(item.get("unidad") or "").strip()[:50]
                categoria = str(item.get("categoria") or "").strip()[:120]
                material_obj, _ = Material.objects.get_or_create(
                    nombre=nombre_material,
                    defaults={"unidad": unidad, "categoria": categoria},
                )

                cambios = []
                if unidad and material_obj.unidad != unidad:
                    material_obj.unidad = unidad
                    cambios.append("unidad")
                if categoria and material_obj.categoria != categoria:
                    material_obj.categoria = categoria
                    cambios.append("categoria")
                if cambios:
                    cambios.append("actualizado_en")
                    material_obj.save(update_fields=cambios)

                precio = _parse_precio(item.get("precio"))
                if precio is None:
                    continue
                precios_encontrados += 1

                fuente = str(item.get("fuente") or "insucons.com").strip()[:120]
                moneda = str(item.get("moneda") or "BOB").strip()[:10]

                ultimo = (
                    PrecioMaterialScrapeado.objects.filter(
                        nombre_material=nombre_material,
                        fuente=fuente,
                    )
                    .order_by("-scrapeado_en")
                    .first()
                )
                if (
                    ultimo
                    and ultimo.precio == precio
                    and (ahora - ultimo.scrapeado_en).total_seconds() < DEDUPE_SEGUNDOS
                ):
                    materiales_tocados[nombre_material] = material_obj
                    continue

                PrecioMaterialScrapeado.objects.create(
                    material=material_obj,
                    nombre_material=nombre_material,
                    precio=precio,
                    moneda=moneda,
                    fuente=fuente,
                    url_origen=str(item.get("url") or "")[:500],
                    scrapeado_en=ahora,
                )
                precios_guardados += 1
                materiales_tocados[nombre_material] = material_obj

            for material_obj in materiales_tocados.values():
                try:
                    material_obj.actualizar_precio_desde_historial()
                except Exception as exc:  # noqa: BLE001
                    errores.setdefault(material_obj.nombre, []).append(str(exc))
    else:
        precios_encontrados = sum(1 for item in catalogo if _parse_precio(item.get("precio")) is not None)

    duracion = time.perf_counter() - inicio
    estado = EjecucionScrapingMaterial.ESTADO_EXITO
    if errores and precios_guardados == 0 and persistir:
        estado = EjecucionScrapingMaterial.ESTADO_ERROR
    elif errores:
        estado = EjecucionScrapingMaterial.ESTADO_PARCIAL

    if registrar_ejecucion:
        _registrar_ejecucion(
            estado=estado,
            materiales=["__INSUCONS_CATALOGO_COMPLETO__"],
            procesados=len(catalogo),
            precios_encontrados=precios_encontrados,
            precios_guardados=precios_guardados,
            errores=errores,
            duracion_segundos=duracion,
        )

    return {
        "ok": True,
        "materiales_catalogo": len(
            {
                str(item.get("nombre_material") or "").strip()
                for item in catalogo
                if str(item.get("nombre_material") or "").strip()
            }
        ),
        "filas_catalogo": len(catalogo),
        "precios_encontrados": precios_encontrados,
        "precios_guardados": precios_guardados,
        "duracion_segundos": round(duracion, 2),
        "dry_run": not persistir,
    }
