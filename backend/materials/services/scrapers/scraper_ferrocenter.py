"""
Scraper para ferrocenter.com (Ferrocenter Bolivia)
Sitio con catalogo extenso de materiales de construccion.
"""
import logging
import re
from typing import Any

import requests
from bs4 import BeautifulSoup

from materials.services.utils.normalizer import coincide_material, normalizar_material, normalizar_precio

logger = logging.getLogger(__name__)

FUENTE = "ferrocenter.com"
URL_BASE = "https://www.ferrocenter.com"
URL_BUSQUEDA = "https://www.ferrocenter.com/buscar?q={query}"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept-Language": "es-ES,es;q=0.9",
}


def _extraer_precio(texto: str) -> float | None:
    """Extrae precio de un texto que puede contener Bs o BOB."""
    # Patrones comunes: "Bs. 150.00", "Bs 150.00", "BOB 150.00", "150.00 Bs"
    patron = re.compile(
        r"(?:Bs\.?\s*)?([\d.,]+)\s*(?:Bs\.?|BOB)?",
        re.IGNORECASE,
    )
    match = patron.search(texto)
    if match:
        return normalizar_precio(match.group(1))
    return None


def _es_producto_valido(nombre: str) -> bool:
    """Filtra textos que no son productos reales."""
    if not nombre or len(nombre.strip()) < 5:
        return False
    invalidos = {
        "ver producto",
        "ver mas",
        "ver más",
        "agregar",
        "carrito",
        "comparar",
        "wishlist",
        "quick",
    }
    nombre_lower = nombre.lower()
    for palabra in invalidos:
        if palabra in nombre_lower:
            return False
    return True


def _scrapear_pagina(url: str, session: requests.Session, timeout: int) -> list[dict[str, Any]]:
    """Hace scraping de una pagina de listad o producto individual."""
    resultados: list[dict[str, Any]] = []
    seen: set[float] = set()

    try:
        resp = session.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("[%s] Error cargando %s: %s", FUENTE, url, exc)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")

    # Intentar extraer de estructura de catalogo
    for item in soup.select(".product-item, .producto-item, .item-producto"):
        titulo_elem = item.select_one("h3, h2, .product-title, .titulo-producto")
        if not titulo_elem:
            continue
        nombre = titulo_elem.get_text(" ", strip=True)
        if not _es_producto_valido(nombre):
            continue

        # Buscar precio en el item
        precio_elem = item.select_one(".price, .precio, .product-price, .Precio, [class*='price']")
        if precio_elem:
            precio = _extraer_precio(precio_elem.get_text())
        else:
            precio = _extraer_precio(item.get_text())

        if precio and precio > 0:
            if precio in seen:
                continue
            seen.add(precio)
            resultados.append({"precio": precio, "moneda": "BOB", "fuente": FUENTE})

    # Buscar en resultados de busqueda
    for item in soup.select(".search-result, .resultado-busqueda, article"):
        enlace = item.select_one("a[href]")
        if not enlace:
            continue
        nombre = enlace.get_text(" ", strip=True)
        if not _es_producto_valido(nombre):
            continue

        precio = _extraer_precio(item.get_text())
        if precio and precio > 0:
            if precio in seen:
                continue
            seen.add(precio)
            resultados.append({"precio": precio, "moneda": "BOB", "fuente": FUENTE})

    return resultados


def scraper_ferrocenter(material: str, timeout: int = 10) -> list[dict[str, Any]]:
    """Busca precios en Ferrocenter usando su busqueda."""
    resultados: list[dict[str, Any]] = []
    seen: set[float] = set()
    material_norm = normalizar_material(material)

    try:
        session = requests.Session()
        url = URL_BUSQUEDA.format(query=material.replace(" ", "%20"))
        resp = session.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("[%s] Error de red: %s", FUENTE, exc)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")

    # Extraer todos los productos de la pagina
    for item in soup.select(".product, .producto, .item"):
        titulo_elem = item.select_one("h3, h2, h4, .product-name, .product-title, .nombre")
        if titulo_elem:
            nombre = titulo_elem.get_text(" ", strip=True)
        else:
            enlace = item.select_one("a")
            nombre = enlace.get_text(" ", strip=True) if enlace else ""

        if not _es_producto_valido(nombre):
            continue

        nombre_norm = normalizar_material(nombre)
        if not coincide_material(material_norm, nombre_norm):
            continue

        # Extraer precio
        precio_elem = item.select_one(
            ".price, .precio, .product-price, .current-price, "
            "[class*='price'], .woocommerce-Price-amount"
        )
        if precio_elem:
            precio_texto = precio_elem.get_text(" ", strip=True)
        else:
            precio_texto = item.get_text()

        precio = _extraer_precio(precio_texto)
        if precio and precio > 0:
            if precio in seen:
                continue
            seen.add(precio)
            resultados.append({"precio": precio, "moneda": "BOB", "fuente": FUENTE})

    logger.info("[%s] %s: %d precios encontrados", FUENTE, material, len(resultados))
    return resultados