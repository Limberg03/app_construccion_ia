import logging
import json
import os
from typing import Any

import requests
from bs4 import BeautifulSoup

from materials.services.utils.normalizer import coincide_material, normalizar_material, normalizar_precio

logger = logging.getLogger(__name__)

FUENTE = "insucons.com"
URL_LISTADO = "https://www.insucons.com/insumos/materiales"
URL_JSON = "https://www.insucons.com/insumos/json_datos/mat"
MAX_PAGINAS = int(os.getenv("INSUCONS_MAX_PAGES", "5"))
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}


def _post_headers() -> dict[str, str]:
    return {
        **HEADERS,
        "X-Requested-With": "XMLHttpRequest",
        "Referer": URL_LISTADO,
        "Origin": "https://www.insucons.com",
    }


def _extraer_desde_rows(rows: list[dict[str, Any]], material_buscado: str) -> list[dict[str, Any]]:
    resultados: list[dict[str, Any]] = []
    for fila in rows:
        celdas = fila.get("cell") or []
        if len(celdas) < 5:
            continue

        descripcion = normalizar_material(str(celdas[2]))
        if not coincide_material(material_buscado, descripcion):
            continue

        precio = normalizar_precio(str(celdas[4]))
        if precio is None:
            continue

        resultados.append({"precio": precio, "moneda": "BOB", "fuente": FUENTE})

    return resultados


def _obtener_json_inicial(session: requests.Session, timeout: int) -> tuple[dict[str, Any], int]:
    try:
        respuesta = session.get(URL_LISTADO, headers=HEADERS, timeout=timeout)
        respuesta.raise_for_status()
        soup = BeautifulSoup(respuesta.text, "html.parser")
        nodo_json = soup.select_one("span#json_mat")
        if not nodo_json:
            return {}, 1

        payload = json.loads(nodo_json.get_text(strip=True) or "{}")
        total_paginas = int(payload.get("total") or 1)
        return payload, total_paginas
    except requests.RequestException as exc:
        logger.warning("[%s] Error de red al cargar listado inicial: %s", FUENTE, exc)
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("[%s] No se pudo parsear json_mat: %s", FUENTE, exc)

    return {}, 1


def _obtener_pagina(session: requests.Session, pagina: int, timeout: int) -> list[dict[str, Any]]:
    payload = {
        "_search": "false",
        "nd": "1710000000000",
        "rows": "20",
        "page": str(pagina),
        "sidx": "insumo:descripcion",
        "sord": "asc",
    }
    try:
        respuesta = session.post(URL_JSON, headers=_post_headers(), data=payload, timeout=timeout)
        respuesta.raise_for_status()
        data = respuesta.json()
        return data.get("rows") or []
    except requests.RequestException as exc:
        logger.warning("[%s] Error consultando pagina %s: %s", FUENTE, pagina, exc)
    except ValueError as exc:
        logger.warning("[%s] Error parseando JSON pagina %s: %s", FUENTE, pagina, exc)

    return []


def scraper_ejemplo2(material: str, timeout: int = 8) -> list[dict[str, Any]]:
    """Scraper de Insucons usando su listado de materiales por paginas."""
    session = requests.Session()
    material_buscado = normalizar_material(material)
    resultados: list[dict[str, Any]] = []
    dedupe: set[float] = set()

    inicial, total_paginas = _obtener_json_inicial(session=session, timeout=timeout)
    resultados.extend(_extraer_desde_rows(inicial.get("rows") or [], material_buscado))

    limite = min(max(total_paginas, 1), max(MAX_PAGINAS, 1))
    for pagina in range(2, limite + 1):
        rows = _obtener_pagina(session=session, pagina=pagina, timeout=timeout)
        resultados.extend(_extraer_desde_rows(rows, material_buscado))

    salida: list[dict[str, Any]] = []
    for item in resultados:
        precio = item.get("precio")
        if precio in dedupe:
            continue
        dedupe.add(precio)
        salida.append(item)

    return salida
