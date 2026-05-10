import re
from typing import Optional


def normalizar_material(material: str) -> str:
    """Normaliza el nombre del material para comparaciones y busqueda."""
    return material.strip().lower()


def coincide_material(material_buscado: str, descripcion: str) -> bool:
    """Comprueba si una descripcion corresponde al material buscado sin capturar accesorios.

    La coincidencia exige que la descripcion empiece con el material buscado
    (aceptando plural simple), para evitar que terminos como "rulemanes para
    ventanas" o "riles de ventana" se tomen como si fueran la ventana principal.
    """
    material = normalizar_material(material_buscado)
    texto = normalizar_material(descripcion)
    if not material or not texto:
        return False

    patron = rf"^{re.escape(material)}s?(?:\b|[-/])"
    return re.search(patron, texto) is not None


def normalizar_precio(texto: str) -> Optional[float]:
    """Convierte textos como 'Bs 1.250,50' o 'BOB 50' en float."""
    if not texto:
        return None

    limpio = texto.strip().replace("BOB", "").replace("Bs.", "").replace("Bs", "")
    limpio = limpio.replace(" ", "")

    coincidencia = re.search(r"-?[\d\.,]+", limpio)
    if not coincidencia:
        return None

    numero = coincidencia.group(0)

    # Soporta formatos: 1.234,56 | 1,234.56 | 1234.56 | 1234,56
    if "," in numero and "." in numero:
        if numero.rfind(",") > numero.rfind("."):
            numero = numero.replace(".", "").replace(",", ".")
        else:
            numero = numero.replace(",", "")
    elif "," in numero:
        numero = numero.replace(",", ".")

    try:
        return float(numero)
    except ValueError:
        return None
