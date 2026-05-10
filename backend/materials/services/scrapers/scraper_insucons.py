"""Scraper de insucons.com con soporte de catalogo completo."""

import logging
import os
import time
from typing import Any

import requests
from bs4 import BeautifulSoup

from materials.services.utils.normalizer import coincide_material, normalizar_material, normalizar_precio

logger = logging.getLogger(__name__)

FUENTE = "insucons.com"
URL_API = "https://www.insucons.com/insumos/json_datos/materiales"
URL_LISTADO = "https://www.insucons.com/insumos/materiales"
URL_SET_CIUDAD = "https://www.insucons.com/insumos/set_ciudad/{ciudad_id}"

# Cantidad de filas por pagina solicitada a jqGrid.
FILAS_POR_PAGINA = int(os.getenv("INSUCONS_FILAS_POR_PAGINA", "200"))
# 0 = sin limite (usa todas las paginas reportadas por la API)
MAX_PAGINAS = int(os.getenv("INSUCONS_MAX_PAGES", "0"))
# Cache corta para evitar descargar el catalogo completo varias veces en la misma ejecucion.
CACHE_SEGUNDOS = int(os.getenv("INSUCONS_CACHE_SECONDS", "120"))
GRUPO_TODOS_ID = int(os.getenv("INSUCONS_GRUPO_TODOS_ID", "1"))
INCLUIR_TODAS_CIUDADES = os.getenv("INSUCONS_TODAS_CIUDADES", "1").strip() != "0"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "es-ES,es;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": URL_LISTADO,
    "Origin": "https://www.insucons.com",
}

IDX_DESCRIPCION = 2
IDX_UNIDAD = 3
IDX_PRECIO = 4
IDX_CATEGORIA = 5

_catalog_cache: dict[str, Any] = {"ts": 0.0, "data": []}


def _build_params(page: int, rows: int, grupoid: int) -> dict[str, str]:
    return {
        "_search": "false",
        "nd": str(int(time.time() * 1000)),
        "rows": str(rows),
        "page": str(page),
        "sidx": "insumo:descripcion",
        "sord": "asc",
        "grupoid": str(grupoid),
    }


def _extraer_ciudades(html: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    ciudades: list[tuple[str, str]] = []
    vistos: set[str] = set()

    for opcion in soup.select("select[name='ciudadid'] option"):
        ciudad_id = str(opcion.get("value") or "").strip()
        nombre = str(opcion.get_text(" ", strip=True) or "").strip()
        if not ciudad_id or ciudad_id in vistos:
            continue
        vistos.add(ciudad_id)
        ciudades.append((ciudad_id, nombre or f"ciudad-{ciudad_id}"))

    return ciudades


def _set_ciudad(session: requests.Session, timeout: int, ciudad_id: str) -> bool:
    try:
        respuesta = session.post(
            URL_SET_CIUDAD.format(ciudad_id=ciudad_id),
            headers=HEADERS,
            timeout=timeout,
        )
        respuesta.raise_for_status()
        return True
    except requests.RequestException as exc:
        logger.warning("[%s] No se pudo fijar ciudad %s: %s", FUENTE, ciudad_id, exc)
        return False


def _pedir_pagina(
    session: requests.Session,
    timeout: int,
    *,
    page: int,
    rows: int,
    grupoid: int,
) -> dict[str, Any]:
    try:
        respuesta = session.post(
            URL_API,
            headers=HEADERS,
            data=_build_params(page=page, rows=rows, grupoid=grupoid),
            timeout=timeout,
        )
        respuesta.raise_for_status()
        payload = respuesta.json()
        return payload if isinstance(payload, dict) else {}
    except requests.RequestException as exc:
        logger.warning("[%s] Error de red en pagina %s: %s", FUENTE, page, exc)
    except ValueError as exc:
        logger.warning("[%s] Error parseando JSON de pagina %s: %s", FUENTE, page, exc)
    return {}


def _parse_rows(rows: list[dict[str, Any]], *, ciudad_id: str, ciudad_nombre: str) -> list[dict[str, Any]]:
    salida: list[dict[str, Any]] = []
    vistos: set[tuple[str, float, str]] = set()

    for fila in rows:
        celdas = fila.get("cell") or []
        if len(celdas) <= IDX_PRECIO:
            continue

        descripcion = str(celdas[IDX_DESCRIPCION] or "").strip()
        if not descripcion:
            continue

        unidad = str(celdas[IDX_UNIDAD] or "").strip()
        categoria = str(celdas[IDX_CATEGORIA] or "").strip() if len(celdas) > IDX_CATEGORIA else ""
        precio = normalizar_precio(str(celdas[IDX_PRECIO] or ""))
        if precio is None:
            continue

        nombre_norm = normalizar_material(descripcion)
        clave = (nombre_norm, precio, ciudad_id)
        if clave in vistos:
            continue
        vistos.add(clave)

        salida.append(
            {
                "nombre_material": nombre_norm,
                "descripcion": descripcion,
                "precio": precio,
                "moneda": "BOB",
                "fuente": f"{FUENTE} [{ciudad_nombre}]",
                "unidad": unidad,
                "categoria": categoria,
                "ciudad": ciudad_nombre,
                "url": f"{URL_LISTADO}?ciudadid={ciudad_id}",
            }
        )

    return salida


def _material_coincide(descripcion_norm: str, material_buscado: str) -> bool:
    return coincide_material(material_buscado, descripcion_norm)


def obtener_catalogo_insucons(timeout: int = 12, *, force_refresh: bool = False) -> list[dict[str, Any]]:
    ahora = time.time()
    if (
        not force_refresh
        and _catalog_cache.get("data")
        and (ahora - float(_catalog_cache.get("ts") or 0.0) < max(CACHE_SEGUNDOS, 1))
    ):
        return list(_catalog_cache["data"])

    session = requests.Session()
    rows_per_page = max(20, FILAS_POR_PAGINA)
    grupoid = max(1, GRUPO_TODOS_ID)

    try:
        respuesta = session.get(URL_LISTADO, headers=HEADERS, timeout=timeout)
        respuesta.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("[%s] Error cargando listado base: %s", FUENTE, exc)
        return []

    ciudades = _extraer_ciudades(respuesta.text)
    if not ciudades:
        ciudades = [("1", "Ciudad")]
    if not INCLUIR_TODAS_CIUDADES:
        ciudades = ciudades[:1]

    catalogo: list[dict[str, Any]] = []
    ciudades_ok = 0

    for ciudad_id, ciudad_nombre in ciudades:
        if not _set_ciudad(session, timeout, ciudad_id):
            continue

        primera = _pedir_pagina(
            session,
            timeout,
            page=1,
            rows=rows_per_page,
            grupoid=grupoid,
        )
        if not primera:
            continue
        ciudades_ok += 1

        total_paginas = int(primera.get("total") or 1)
        if MAX_PAGINAS > 0:
            total_paginas = min(total_paginas, MAX_PAGINAS)

        catalogo.extend(
            _parse_rows(
                primera.get("rows") or [],
                ciudad_id=ciudad_id,
                ciudad_nombre=ciudad_nombre,
            )
        )

        for pagina in range(2, total_paginas + 1):
            payload = _pedir_pagina(
                session,
                timeout,
                page=pagina,
                rows=rows_per_page,
                grupoid=grupoid,
            )
            if not payload:
                continue
            catalogo.extend(
                _parse_rows(
                    payload.get("rows") or [],
                    ciudad_id=ciudad_id,
                    ciudad_nombre=ciudad_nombre,
                )
            )

    if ciudades_ok == 0:
        return []

    # Dedupe global del catalogo.
    resultado: list[dict[str, Any]] = []
    vistos_global: set[tuple[str, float, str]] = set()
    for item in catalogo:
        clave = (
            str(item.get("nombre_material") or ""),
            float(item.get("precio") or 0),
            str(item.get("ciudad") or ""),
        )
        if clave in vistos_global:
            continue
        vistos_global.add(clave)
        resultado.append(item)

    _catalog_cache["ts"] = ahora
    _catalog_cache["data"] = list(resultado)

    logger.info(
        "[%s] Catalogo completo obtenido: %d items (%d ciudades)",
        FUENTE,
        len(resultado),
        ciudades_ok,
    )
    return resultado


def scraper_insucons(material: str, timeout: int = 12) -> list[dict[str, Any]]:
    material_buscado = normalizar_material(material)
    catalogo = obtener_catalogo_insucons(timeout=timeout)
    if not catalogo:
        return []

    resultados = [
        {
            "precio": item["precio"],
            "moneda": item["moneda"],
            "fuente": item["fuente"],
            "descripcion": item["descripcion"],
            "unidad": item["unidad"],
            "categoria": item["categoria"],
            "url": item["url"],
        }
        for item in catalogo
        if _material_coincide(str(item.get("nombre_material") or ""), material_buscado)
    ]

    resultados.sort(key=lambda item: item.get("precio", 0))
    logger.info("[%s] '%s': %d coincidencias", FUENTE, material_buscado, len(resultados))
    return resultados