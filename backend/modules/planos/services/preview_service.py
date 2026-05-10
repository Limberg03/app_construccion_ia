"""
Generador de previews para planos de construccion.
Crea representaciones 2D tecnicas y vistas exteriores estilizadas.
"""
import base64
from io import BytesIO
from typing import Any

from PIL import Image, ImageDraw


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_data_url(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _palette_by_style(estilo: str) -> dict[str, tuple[int, int, int]]:
    """Paletas de color por estilo arquitectonico."""
    estilo = str(estilo or "").strip().lower()
    palettes = {
        "contemporaneo": {
            "wall": (235, 238, 242),
            "roof": (85, 92, 105),
            "trim": (200, 205, 212),
            "ground": (85, 100, 75),
            "sky": (200, 215, 230),
        },
        "moderno": {
            "wall": (240, 240, 238),
            "roof": (60, 65, 75),
            "trim": (255, 255, 255),
            "ground": (90, 105, 80),
            "sky": (195, 210, 225),
        },
        "colonial": {
            "wall": (220, 200, 175),
            "roof": (100, 75, 65),
            "trim": (245, 238, 225),
            "ground": (75, 95, 60),
            "sky": (185, 200, 215),
        },
        "cabana": {
            "wall": (210, 180, 140),
            "roof": (80, 55, 45),
            "trim": (230, 215, 195),
            "ground": (70, 90, 55),
            "sky": (175, 195, 210),
        },
    }
    return palettes.get(
        estilo,
        {
            "wall": (238, 242, 248),
            "roof": (80, 88, 100),
            "trim": (210, 215, 225),
            "ground": (80, 100, 70),
            "sky": (195, 212, 230),
        },
    )


def _collect_rects(vector_data: list[dict]) -> list[dict[str, float | str]]:
    """Extrae rectangulos del plano."""
    items: list[dict[str, float | str]] = []
    for row in vector_data or []:
        if not isinstance(row, dict):
            continue
        tipo = str(row.get("tipo") or "").strip().lower()
        if tipo not in {"muro", "puerta", "ventana"}:
            continue
        x = _to_float(row.get("x"))
        y = _to_float(row.get("y"))
        w = _to_float(row.get("width"))
        h = _to_float(row.get("height"))
        if w <= 0 or h <= 0:
            continue
        items.append({"tipo": tipo, "x": x, "y": y, "w": w, "h": h})
    return items


def generar_preview_plano_2d(vector_data: list[dict], opciones: dict | None = None) -> str:
    """Render tecnico 2D del plano con muros, puertas y ventanas."""
    w, h = 900, 600
    image = Image.new("RGB", (w, h), (252, 253, 255))
    draw = ImageDraw.Draw(image)

    # Borde y marco
    draw.rectangle((15, 15, w - 15, h - 15), outline=(180, 185, 195), width=2)
    draw.rectangle((20, 20, w - 20, h - 20), outline=(200, 205, 215), width=1)

    # Titulo
    draw.text((35, 30), "Plano 2D", fill=(50, 55, 65))
    draw.line((35, 50, 120, 50), fill=(50, 55, 65), width=2)

    rects = _collect_rects(vector_data)
    if not rects:
        draw.text((35, 80), "Sin geometria detectable", fill=(150, 155, 165))
        return _to_data_url(image)

    # Calcular bounding box
    min_x = min(float(item["x"]) for item in rects)
    min_y = min(float(item["y"]) for item in rects)
    max_x = max(float(item["x"]) + float(item["w"]) for item in rects)
    max_y = max(float(item["y"]) + float(item["h"]) for item in rects)

    raw_w = max(1.0, max_x - min_x)
    raw_h = max(1.0, max_y - min_y)

    # Margenes del dibujo
    margin_left = 60
    margin_top = 80
    margin_right = w - 60
    margin_bottom = h - 50
    view_w = margin_right - margin_left
    view_h = margin_bottom - margin_top

    # Escalar para que quepa bien
    scale = min(view_w / raw_w, view_h / raw_h)

    # Funcion helper para dibujar cada elemento
    def to_screen(px, py):
        return (
            margin_left + (float(px) - min_x) * scale,
            margin_top + (float(py) - min_y) * scale,
        )

    # Fondo area de dibujo (papel cuadriculado)
    for yy in range(margin_top, margin_bottom, 20):
        for xx in range(margin_left, margin_right, 20):
            if (xx // 20 + yy // 20) % 2 == 0:
                draw.point((xx, yy), fill=(248, 250, 252))

    # Dibujar muros primero
    for item in rects:
        tipo = str(item["tipo"])
        x0, y0 = to_screen(item["x"], item["y"])
        x1, y1 = x0 + float(item["w"]) * scale, y0 + float(item["h"]) * scale

        if tipo == "muro":
            # Muro: rectangulo solido gris oscuro
            draw.rectangle((x0, y0, x1, y1), fill=(60, 65, 75), outline=(40, 42, 50), width=2)
        elif tipo == "puerta":
            # Puerta: arco棕色 con linea de apertura
            draw.rectangle((x0, y0, x1, y1), fill=(160, 120, 80), outline=(120, 90, 50), width=1)
            # Linea de arco
            mid_x = (x0 + x1) / 2
            if item["w"] > item["h"]:
                draw.arc((x0, y0, x1 + 20, y1 + 20), 0, 180, fill=(100, 75, 40), width=1)
            else:
                draw.arc((x0 - 20, y0, x1 + 20, y1), 90, 270, fill=(100, 75, 40), width=1)
        else:
            # Ventana: rectangulo azul claro
            draw.rectangle((x0, y0, x1, y1), fill=(180, 210, 235), outline=(120, 150, 190), width=1)
            # Cruce de ventana
            cx = (x0 + x1) / 2
            cy = (y0 + y1) / 2
            draw.line((cx, y0, cx, y1), fill=(100, 140, 180), width=1)
            draw.line((x0, cy, x1, cy), fill=(100, 140, 180), width=1)

    # Escala grafica
    escala_x = w - 180
    escala_y = h - 30
    escala_ancho = 100
    draw.line((escala_x, escala_y, escala_x + escala_ancho, escala_y), fill=(80, 85, 95), width=2)
    draw.text((escala_x, escala_y + 5), "0", fill=(80, 85, 95))
    draw.text((escala_x + escala_ancho - 10, escala_y + 5), f"{raw_w:.1f}m", fill=(80, 85, 95))

    return _to_data_url(image)


def generar_preview_exterior(opciones: dict | None = None, variante: str = "frente") -> str:
    """Genera una vista exterior tecnica de la vivienda."""
    opciones = opciones or {}
    estilo = str(opciones.get("estilo") or "contemporaneo").strip().lower()
    pisos = max(1, int(_to_float(opciones.get("pisos"), default=2)))
    tiene_garaje = int(_to_float(opciones.get("garaje"), default=1)) > 0
    tipo_techo = str(opciones.get("tipo_techo") or "techo inclinado").strip().lower()

    p = _palette_by_style(estilo)

    # Dimensiones de la imagen
    w, h = 800, 500
    image = Image.new("RGB", (w, h), p["sky"])
    draw = ImageDraw.Draw(image)

    # Linea de horizonte
    horizon_y = int(h * 0.58)
    draw.rectangle((0, 0, w, horizon_y), fill=p["sky"])

    # Suelo (cesped/tierra)
    draw.rectangle((0, horizon_y, w, h), fill=p["ground"])

    # Calcular dimensiones de la casa
    casa_w = 360
    casa_h = 140 + ((pisos - 1) * 80)
    left = 200
    top = horizon_y - casa_h - 20

    # Sombra de la casa
    shadow_offset = 12
    draw.polygon([
        (left + shadow_offset, horizon_y),
        (left + shadow_offset + casa_w, horizon_y),
        (left + shadow_offset + casa_w, horizon_y + 8),
        (left + shadow_offset, horizon_y + 8),
    ], fill=(50, 60, 40))

    # Cuerpo principal de la casa
    draw.rectangle(
        (left, top, left + casa_w, horizon_y),
        fill=p["wall"],
        outline=(p["roof"][0] - 20, p["roof"][1] - 20, p["roof"][2] - 20),
        width=2,
    )

    # Franja inferior (contrapiso)
    contrapiso_h = 15
    draw.rectangle(
        (left - 5, horizon_y - contrapiso_h, left + casa_w + 5, horizon_y),
        fill=(p["wall"][0] - 15, p["wall"][1] - 15, p["wall"][2] - 15),
        outline=(p["roof"][0] - 20, p["roof"][1] - 20, p["roof"][2] - 20),
        width=1,
    )

    # Techo segun tipo
    roof_y = top - 5
    if tipo_techo == "techo plano":
        # Azotea plana con borde
        draw.rectangle(
            (left - 10, roof_y - 20, left + casa_w + 10, roof_y),
            fill=p["roof"],
            outline=(p["roof"][0] - 30, p["roof"][1] - 30, p["roof"][2] - 30),
            width=2,
        )
        # Pretil
        draw.rectangle(
            (left, roof_y - 12, left + casa_w, roof_y - 8),
            fill=(p["wall"][0] + 10, p["wall"][1] + 10, p["wall"][2] + 10),
        )
    else:
        # Techo inclinado (tradicional)
        roof_left = left - 20
        roof_right = left + casa_w + 20
        roof_center_x = left + casa_w // 2
        roof_top = roof_y - 75

        draw.polygon(
            [(roof_left, roof_y), (roof_center_x, roof_top), (roof_right, roof_y)],
            fill=p["roof"],
            outline=(p["roof"][0] - 30, p["roof"][1] - 30, p["roof"][2] - 30),
            width=2,
        )

        # Linea de cumbrera
        draw.line((roof_center_x, roof_top + 5, roof_center_x, roof_y), fill=(p["roof"][0] - 15, p["roof"][1] - 15, p["roof"][2] - 15), width=2)

    # Ventanas por piso (diseno tecnico, no caricatura)
    ventana_w = 50
    ventana_h = 55
    ventana_margin = 30
    ventana_border = 3

    for piso in range(pisos):
        piso_y = top + 25 + (piso * 80)
        if piso_y + ventana_h > horizon_y - contrapiso_h:
            continue

        # 3 ventanas por piso
        for i, offset in enumerate([60, 150, 240]):
            vx = left + offset
            vy = piso_y

            # Marco de ventana
            draw.rectangle(
                (vx, vy, vx + ventana_w, vy + ventana_h),
                fill=(220, 235, 250),
                outline=(p["roof"][0] - 10, p["roof"][1] - 10, p["roof"][2] - 10),
                width=ventana_border,
            )

            # Divisiones de vidrio (4 quadros)
            mid_h = vy + ventana_h // 2
            mid_v = vx + ventana_w // 2
            draw.line((vx, mid_h, vx + ventana_w, mid_h), fill=(p["trim"][0] - 40, p["trim"][1] - 40, p["trim"][2] - 40), width=1)
            draw.line((mid_v, vy, mid_v, vy + ventana_h), fill=(p["trim"][0] - 40, p["trim"][1] - 40, p["trim"][2] - 40), width=1)

    # Puerta principal (diseno sobrio)
    puerta_w = 60
    puerta_h = 90
    puerta_x = left + (casa_w - puerta_w) // 2 + 20
    puerta_y = horizon_y - contrapiso_h - puerta_h

    # Marco
    draw.rectangle(
        (puerta_x - 4, puerta_y - 4, puerta_x + puerta_w + 4, horizon_y - contrapiso_h),
        fill=(p["roof"][0] + 10, p["roof"][1] + 10, p["roof"][2] + 10),
    )
    # Hoja de puerta
    draw.rectangle(
        (puerta_x, puerta_y, puerta_x + puerta_w, horizon_y - contrapiso_h),
        fill=(p["roof"][0] - 20, p["roof"][1] - 20, p["roof"][2] - 20),
        outline=(p["roof"][0] - 40, p["roof"][1] - 40, p["roof"][2] - 40),
        width=2,
    )
    # Linea central
    draw.line(
        (puerta_x + puerta_w // 2, puerta_y, puerta_x + puerta_w // 2, horizon_y - contrapiso_h),
        fill=(p["roof"][0] - 50, p["roof"][1] - 50, p["roof"][2] - 50),
        width=1,
    )
    # Manija
    draw.ellipse((puerta_x + puerta_w - 12, puerta_y + puerta_h // 2, puerta_x + puerta_w - 6, puerta_y + puerta_h // 2 + 6), fill=(180, 180, 170))

    # Garaje (si aplica)
    if tiene_garaje:
        garaje_w = 120
        garaje_h = 100
        garaje_x = left + casa_w - 30
        garaje_y = horizon_y - contrapiso_h - garaje_h

        # Puerta de garage
        draw.rectangle(
            (garaje_x, garaje_y, garaje_x + garaje_w, horizon_y - contrapiso_h),
            fill=(230, 233, 238),
            outline=(p["roof"][0] - 20, p["roof"][1] - 20, p["roof"][2] - 20),
            width=2,
        )
        # Lineas de la puerta de garage
        for line_y in range(garaje_y + 15, horizon_y - contrapiso_h, 15):
            draw.line((garaje_x + 5, line_y, garaje_x + garaje_w - 5, line_y), fill=(200, 205, 212), width=1)

    # Etiqueta de vista
    label = "VISTA FRENTE" if variante == "frente" else "VISTA LATERAL"
    draw.text((25, 20), label, fill=(40, 45, 55))
    draw.text((25, 38), f"Estilo: {estilo.title()}", fill=(80, 85, 95))

    return _to_data_url(image)


def generar_pack_previews(vector_data: list[dict], opciones: dict | None = None) -> dict[str, str]:
    """Genera todas las vistas previas del plano."""
    return {
        "plano_2d": generar_preview_plano_2d(vector_data, opciones),
        "exterior_1": generar_preview_exterior(opciones, variante="frente"),
        "exterior_2": generar_preview_exterior(opciones, variante="lateral"),
    }