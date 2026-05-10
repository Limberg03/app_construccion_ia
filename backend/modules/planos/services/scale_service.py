import math
import re
from dataclasses import dataclass
from statistics import median
from typing import Any, Iterable, Optional


@dataclass(frozen=True)
class ScaleInference:
    metros_por_pixel: float
    muestras: int


_NUM_RE = re.compile(r"[-+]?\d+(?:[\.,]\d+)?")


def _to_float(s: str) -> Optional[float]:
    try:
        return float(s.replace(",", "."))
    except Exception:
        return None


def _parse_fractional_inches(text: str) -> Optional[float]:
    """Acepta: '9.8', '9', '1/2', '2 1/2'. Devuelve pulgadas."""
    t = text.strip().replace("\u2033", '"')
    if not t:
        return None

    # 2 1/2
    if " " in t and "/" in t:
        parts = t.split()
        if len(parts) == 2:
            whole = _to_float(parts[0])
            frac = parts[1]
            if whole is None:
                return None
            if "/" in frac:
                a, b = frac.split("/", 1)
                fa = _to_float(a)
                fb = _to_float(b)
                if fa is None or fb in (None, 0):
                    return None
                return whole + (fa / fb)

    # 1/2
    if "/" in t and _NUM_RE.search(t):
        a, b = t.split("/", 1)
        fa = _to_float(a)
        fb = _to_float(b)
        if fa is None or fb in (None, 0):
            return None
        return fa / fb

    # decimal/integer
    return _to_float(t)


def parse_medida_a_metros(valor: Any) -> Optional[float]:
    """Parsea medidas comunes de planos a metros.

    Soporta:
    - Métrico: '1.78m', '178 cm', '900mm'
    - Imperial: "27'-9.8\"", "2'-6\"", "12'", '4 in'
    - Numérico sin unidad: se asume metros.

    Devuelve metros o None si no se reconoce.
    """
    if valor is None:
        return None

    if isinstance(valor, (int, float)):
        v = float(valor)
        return v if math.isfinite(v) else None

    s = str(valor).strip().lower()
    if not s:
        return None

    s = s.replace("\u2032", "'").replace("\u2033", '"')

    # Métrico explícito
    if "mm" in s:
        m = _NUM_RE.search(s)
        if not m:
            return None
        num = _to_float(m.group(0))
        return None if num is None else num / 1000.0

    if "cm" in s:
        m = _NUM_RE.search(s)
        if not m:
            return None
        num = _to_float(m.group(0))
        return None if num is None else num / 100.0

    if "m" in s:
        # cuidado: 'mm'/'cm' ya se manejó arriba
        m = _NUM_RE.search(s)
        if not m:
            return None
        num = _to_float(m.group(0))
        return None if num is None else num

    # Imperial (pies/pulgadas)
    # Ej: 27'-9.8" / 2'-6" / 12' / 4" / 4 in / 6 ft
    feet = None
    inches = None

    if "ft" in s or "feet" in s:
        m = _NUM_RE.search(s)
        if m:
            feet = _to_float(m.group(0))

    if "'" in s:
        before, _, after = s.partition("'")
        m = _NUM_RE.search(before)
        if m:
            feet = _to_float(m.group(0))
        # pulgadas suelen estar en el resto
        after = after.strip()
        if after:
            # cortar al " si existe
            after = after.replace("in", '"')
            if '"' in after:
                after = after.split('"', 1)[0]
            after = after.lstrip("- ")
            inc = _parse_fractional_inches(after)
            if inc is not None:
                inches = inc

    if '"' in s and feet is None:
        # solo pulgadas
        before = s.split('"', 1)[0]
        inc = _parse_fractional_inches(before)
        if inc is not None:
            inches = inc

    if (feet is not None) or (inches is not None):
        feet = feet or 0.0
        inches = inches or 0.0
        total_inches = feet * 12.0 + inches
        if total_inches <= 0:
            return None
        return total_inches * 0.0254

    # Numérico sin unidad => metros
    m = _NUM_RE.search(s)
    if m:
        num = _to_float(m.group(0))
        return None if num is None else num

    return None


def infer_escala_metros_por_pixel(vector_data: Any) -> Optional[ScaleInference]:
    """Infere metros/pixel a partir de cotas del vector_data."""
    if not isinstance(vector_data, list):
        return None

    muestras: list[float] = []

    for it in vector_data:
        if not isinstance(it, dict):
            continue
        if str(it.get("tipo") or "").strip().lower() != "cota":
            continue

        x1 = it.get("x1")
        y1 = it.get("y1")
        x2 = it.get("x2")
        y2 = it.get("y2")
        try:
            dx = float(x2) - float(x1)
            dy = float(y2) - float(y1)
            dist_px = math.hypot(dx, dy)
        except Exception:
            continue
        if not (dist_px and dist_px > 5):
            continue

        metros = parse_medida_a_metros(it.get("valor"))
        if metros is None or not (metros > 0):
            continue

        m_per_px = metros / dist_px
        # filtros de plausibilidad
        if not (1e-5 < m_per_px < 1.0):
            continue
        muestras.append(m_per_px)

    if len(muestras) < 1:
        return None

    return ScaleInference(metros_por_pixel=float(median(muestras)), muestras=len(muestras))
