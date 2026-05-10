"""
Scraper para constructorbolivia.com
Busca materiales de construccion en el buscador del sitio.
"""
import logging
import re
from typing import Any

import requests
from bs4 import BeautifulSoup

from materials.services.utils.normalizer import coincide_material, normalizar_material, normalizar_precio

logger = logging.getLogger(__name__)

FUENTE = "constructorbolivia.com"
URL_BUSQUEDA = "https://www.constructorbolivia.com/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept-Language": "es-ES,es;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def _extraer_precio(nodo) -> float | None:
    """Busca precio en el texto cercano al nodo del producto."""
    patron = re.compile(
        r"(?:Bs\.?|Bs|BOB|Bob)\s*([\d.,]+)",
        re.IGNORECASE,
    )
    # Subir hasta 10 niveles de padres buscando precio
    actual = nodo
    for _ in range(10):
        actual = actual.parent if actual else None
        if not actual:
            break
        texto = actual.get_text(" ", strip=True)
        coincidencia = patron.search(texto)
        if coincidencia:
            precio = normalizar_precio(coincidencia.group(1))
            if precio and precio > 0:
                return precio
    return None


def _es_producto_valido(nombre: str) -> bool:
    """Filtra textos que no son productos reales."""
    invalidos = {
        "seleccionar opciones",
        "leer mas",
        "leer más",
        "agregar al carrito",
        "comprar",
        "ver producto",
        "ver detalles",
        "quick-view",
        "out of stock",
        "sin stock",
        "agotado",
    }
    nombre_lower = nombre.lower().strip()
    return nombre_lower not in invalidos and len(nombre) > 3


def scraper_constructorbolivia(material: str, timeout: int = 10) -> list[dict[str, Any]]:
    """Busca precios en constructorbolivia.com usando su API de busqueda."""
    resultados: list[dict[str, Any]] = []
    seen: set[float] = set()
    material_norm = normalizar_material(material)

    try:
        session = requests.Session()
        # Intentar busqueda via GET con parametro s
        url = f"{URL_BUSQUEDA}?s={material.replace(' ', '+')}&post_type=product"
        resp = session.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("[%s] Error de red: %s", FUENTE, exc)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")

    # Selector 1: productos en grid de woocommerce
    for producto in soup.select("li.product"):
        enlace = producto.select_one("a.woocommerce-LoopProduct-link")
        if not enlace:
            continue
        nombre = enlace.get_text(" ", strip=True)
        if not _es_producto_valido(nombre):
            continue
        nombre_norm = normalizar_material(nombre)
        if not coincide_material(material_norm, nombre_norm):
            continue

        precio = _extraer_precio(producto)
        if not precio:
            continue
        if precio in seen:
            continue
        seen.add(precio)
        resultados.append({"precio": precio, "moneda": "BOB", "fuente": FUENTE})

    # Selector 2: enlaces directos a productos
    for enlace in soup.select("a[href*='/producto/']"):
        nombre = enlace.get_text(" ", strip=True)
        if not _es_producto_valido(nombre):
            continue
        nombre_norm = normalizar_material(nombre)
        if not coincide_material(material_norm, nombre_norm):
            continue

        precio = _extraer_precio(enlace)
        if not precio:
            continue
        if precio in seen:
            continue
        seen.add(precio)
        resultados.append({"precio": precio, "moneda": "BOB", "fuente": FUENTE})

    # Selector 3: buscar en resultado de busqueda de WordPress
    for item in soup.select(".search-results li, .products li"):
        enlace = item.select_one("a")
        if not enlace:
            continue
        nombre = item.get_text(" ", strip=True)
        if not _es_producto_valido(nombre):
            continue
        nombre_norm = normalizar_material(nombre)
        if not coincide_material(material_norm, nombre_norm):
            continue

        precio = _extraer_precio(item)
        if not precio:
            continue
        if precio in seen:
            continue
        seen.add(precio)
        resultados.append({"precio": precio, "moneda": "BOB", "fuente": FUENTE})

    logger.info("[%s] %s: %d precios encontrados", FUENTE, material, len(resultados))
    return resultados