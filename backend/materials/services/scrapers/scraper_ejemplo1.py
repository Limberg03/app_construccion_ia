import logging
import re
from typing import Any
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

from materials.services.utils.normalizer import coincide_material, normalizar_material, normalizar_precio

logger = logging.getLogger(__name__)

FUENTE = "constructorbolivia.com"
URL_BUSQUEDA = "https://www.constructorbolivia.com/?s={query}&post_type=product"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}


def _extraer_precio_desde_contexto(nodo) -> float | None:
    """Busca un precio en el texto cercano al nodo del producto."""
    precio_patron = re.compile(r"(Bs\.?\s*[\d\.,]+|BOB\s*[\d\.,]+)", re.IGNORECASE)
    actual = nodo
    for _ in range(7):
        actual = actual.parent if actual else None
        if not actual:
            break
        texto = actual.get_text(" ", strip=True)
        coincidencia = precio_patron.search(texto)
        if coincidencia:
            return normalizar_precio(coincidencia.group(1))
    return None


def _obtener_html(material: str, timeout: int = 8) -> str:
    url = URL_BUSQUEDA.format(query=quote_plus(material))
    respuesta = requests.get(url, headers=HEADERS, timeout=timeout)
    respuesta.raise_for_status()
    return respuesta.text


def scraper_ejemplo1(material: str, timeout: int = 8) -> list[dict[str, Any]]:
    """Scraper de Constructor Bolivia basado en resultados HTML de busqueda."""
    try:
        html = _obtener_html(material=material, timeout=timeout)
    except requests.RequestException as exc:
        logger.warning("[%s] Error de red para %s: %s", FUENTE, material, exc)
        return []

    soup = BeautifulSoup(html, "html.parser")
    resultados: list[dict[str, Any]] = []
    material_buscado = normalizar_material(material)
    textos_ignorar = {
        "seleccionar opciones",
        "leer mas",
        "agregar al carrito",
        "comprar",
    }
    dedupe: set[float] = set()

    for enlace in soup.select("a[href*='/producto/']"):
        nombre_raw = enlace.get_text(" ", strip=True)
        nombre = normalizar_material(nombre_raw)
        if not nombre or nombre in textos_ignorar:
            continue
        if not coincide_material(material_buscado, nombre):
            continue

        precio = _extraer_precio_desde_contexto(enlace)
        if precio is None:
            continue

        if precio in dedupe:
            continue
        dedupe.add(precio)

        resultados.append({"precio": precio, "moneda": "BOB", "fuente": FUENTE})

    return resultados
