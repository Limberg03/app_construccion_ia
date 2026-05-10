from __future__ import annotations

import math
from dataclasses import dataclass
from statistics import median
from typing import Any, Dict, Iterable, List, Optional, Tuple


@dataclass(frozen=True)
class PostprocessStats:
    walls_in: int
    walls_out: int
    thickness_px: float
    perimeter_added: int = 0
    cotas_snapped: int = 0


def _isfinite(v: Any) -> bool:
    try:
        return math.isfinite(float(v))
    except Exception:
        return False


def _num(v: Any, default: float = 0.0) -> float:
    try:
        x = float(v)
        return x if math.isfinite(x) else default
    except Exception:
        return default


def _round(v: float, step: float) -> float:
    if step <= 0:
        return v
    return round(v / step) * step


def _edge_clusters(values: List[float], tol: float) -> List[float]:
    if not values:
        return []
    vals = sorted(values)
    clusters: List[List[float]] = [[vals[0]]]
    for v in vals[1:]:
        if abs(v - clusters[-1][-1]) <= tol:
            clusters[-1].append(v)
        else:
            clusters.append([v])
    return [sum(c) / len(c) for c in clusters]


def _snap_to_clusters(v: float, clusters: List[float], tol: float) -> float:
    if not clusters:
        return v
    best = min(clusters, key=lambda c: abs(c - v))
    return best if abs(best - v) <= tol else v


def _rect(it: Dict[str, Any]) -> Tuple[float, float, float, float]:
    x = _num(it.get("x"))
    y = _num(it.get("y"))
    w = max(0.0, _num(it.get("width")))
    h = max(0.0, _num(it.get("height")))
    return x, y, w, h


def _bbox(rects: List[Tuple[float, float, float, float]]) -> Optional[Tuple[float, float, float, float]]:
    if not rects:
        return None
    xs = [r[0] for r in rects]
    ys = [r[1] for r in rects]
    x2 = [r[0] + r[2] for r in rects]
    y2 = [r[1] + r[3] for r in rects]
    return min(xs), min(ys), max(x2), max(y2)


def _cota_intersections_h(x1: float, x2: float, y: float, wall_rects: List[Tuple[float, float, float, float]], pad: float) -> int:
    a = min(x1, x2)
    b = max(x1, x2)
    hits = 0
    for wx, wy, ww, wh in wall_rects:
        if ww <= 0 or wh <= 0:
            continue
        if (y < wy - pad) or (y > wy + wh + pad):
            continue
        if b < wx - pad or a > wx + ww + pad:
            continue
        hits += 1
    return hits


def _cota_intersections_v(x: float, y1: float, y2: float, wall_rects: List[Tuple[float, float, float, float]], pad: float) -> int:
    a = min(y1, y2)
    b = max(y1, y2)
    hits = 0
    for wx, wy, ww, wh in wall_rects:
        if ww <= 0 or wh <= 0:
            continue
        if (x < wx - pad) or (x > wx + ww + pad):
            continue
        if b < wy - pad or a > wy + wh + pad:
            continue
        hits += 1
    return hits


def _postprocess_cotas(
    items: List[Dict[str, Any]],
    *,
    wall_rects: List[Tuple[float, float, float, float]],
    x_clusters: List[float],
    y_clusters: List[float],
    edge_tol: float,
    thickness_px: float,
) -> Tuple[List[Dict[str, Any]], int]:
    if not items:
        return items, 0

    snapped = 0
    out: List[Dict[str, Any]] = []

    tol = max(6.0, edge_tol * 2.0)
    pad = max(3.0, thickness_px * 0.35)
    step = max(6.0, thickness_px * 0.9)

    for it in items:
        if str(it.get("tipo") or "").lower() != "cota":
            out.append(it)
            continue

        try:
            x1 = float(it.get("x1"))
            y1 = float(it.get("y1"))
            x2 = float(it.get("x2"))
            y2 = float(it.get("y2"))
        except Exception:
            out.append(it)
            continue

        if not (_isfinite(x1) and _isfinite(y1) and _isfinite(x2) and _isfinite(y2)):
            out.append(it)
            continue

        dx = x2 - x1
        dy = y2 - y1
        orient = "h" if abs(dx) >= abs(dy) else "v"

        patched = dict(it)

        if orient == "h":
            sx1 = _snap_to_clusters(x1, x_clusters, tol)
            sx2 = _snap_to_clusters(x2, x_clusters, tol)
            sy = _snap_to_clusters((y1 + y2) * 0.5, y_clusters, tol)

            # fuerza horizontal
            ax = min(sx1, sx2)
            bx = max(sx1, sx2)
            y = sy

            # si intersecta muros, empuja arriba/abajo buscando zona limpia
            best_y = y
            best_hits = _cota_intersections_h(ax, bx, y, wall_rects, pad)
            if best_hits > 0:
                for k in range(1, 5):
                    y_up = y - step * k
                    y_dn = y + step * k
                    h_up = _cota_intersections_h(ax, bx, y_up, wall_rects, pad)
                    h_dn = _cota_intersections_h(ax, bx, y_dn, wall_rects, pad)
                    # preferimos la menor intersección y el menor desplazamiento
                    cand = [(h_up, y_up), (h_dn, y_dn)]
                    cand.sort(key=lambda t: (t[0], abs(t[1] - y)))
                    if cand[0][0] < best_hits:
                        best_hits, best_y = cand[0]
                    if best_hits == 0:
                        break

            patched["x1"] = float(ax)
            patched["y1"] = float(best_y)
            patched["x2"] = float(bx)
            patched["y2"] = float(best_y)
            snapped += 1
        else:
            sx = _snap_to_clusters((x1 + x2) * 0.5, x_clusters, tol)
            sy1 = _snap_to_clusters(y1, y_clusters, tol)
            sy2 = _snap_to_clusters(y2, y_clusters, tol)

            ay = min(sy1, sy2)
            by = max(sy1, sy2)
            x = sx

            best_x = x
            best_hits = _cota_intersections_v(x, ay, by, wall_rects, pad)
            if best_hits > 0:
                for k in range(1, 5):
                    x_l = x - step * k
                    x_r = x + step * k
                    h_l = _cota_intersections_v(x_l, ay, by, wall_rects, pad)
                    h_r = _cota_intersections_v(x_r, ay, by, wall_rects, pad)
                    cand = [(h_l, x_l), (h_r, x_r)]
                    cand.sort(key=lambda t: (t[0], abs(t[1] - x)))
                    if cand[0][0] < best_hits:
                        best_hits, best_x = cand[0]
                    if best_hits == 0:
                        break

            patched["x1"] = float(best_x)
            patched["y1"] = float(ay)
            patched["x2"] = float(best_x)
            patched["y2"] = float(by)
            snapped += 1

        out.append(patched)

    return out, snapped


def _orientation(w: float, h: float) -> str:
    if w >= h:
        return "h"  # horizontal (length along x)
    return "v"      # vertical (length along y)


def _thickness(w: float, h: float) -> float:
    return min(w, h)


def _length(w: float, h: float) -> float:
    return max(w, h)


def _merge_segments(segments: List[Dict[str, Any]], *, orient: str, gap_tol: float, align_tol: float) -> List[Dict[str, Any]]:
    # segments must be normalized (thickness already set, axis-aligned)
    if not segments:
        return []

    def key_fn(s: Dict[str, Any]) -> float:
        x, y, w, h = _rect(s)
        return y if orient == "h" else x

    segs = sorted(segments, key=key_fn)
    merged: List[Dict[str, Any]] = []

    for s in segs:
        x, y, w, h = _rect(s)
        if w <= 0 or h <= 0:
            continue

        if not merged:
            merged.append(dict(s))
            continue

        last = merged[-1]
        lx, ly, lw, lh = _rect(last)

        if orient == "h":
            # aligned y and thickness
            if abs(y - ly) > align_tol or abs(h - lh) > align_tol:
                merged.append(dict(s))
                continue

            # merge if overlaps or small gap
            last_end = lx + lw
            this_end = x + w
            if x <= last_end + gap_tol:
                new_x = min(lx, x)
                new_end = max(last_end, this_end)
                last["x"] = new_x
                last["width"] = max(1.0, new_end - new_x)
                # keep y/height
            else:
                merged.append(dict(s))
        else:
            if abs(x - lx) > align_tol or abs(w - lw) > align_tol:
                merged.append(dict(s))
                continue

            last_end = ly + lh
            this_end = y + h
            if y <= last_end + gap_tol:
                new_y = min(ly, y)
                new_end = max(last_end, this_end)
                last["y"] = new_y
                last["height"] = max(1.0, new_end - new_y)
            else:
                merged.append(dict(s))

    return merged


def _merge_intervals(intervals: List[Tuple[float, float]], *, gap_tol: float) -> List[Tuple[float, float]]:
    if not intervals:
        return []
    ivs = sorted([(min(a, b), max(a, b)) for a, b in intervals], key=lambda t: (t[0], t[1]))
    out: List[Tuple[float, float]] = [ivs[0]]
    for a, b in ivs[1:]:
        la, lb = out[-1]
        if a <= lb + gap_tol:
            out[-1] = (la, max(lb, b))
        else:
            out.append((a, b))
    return out


def _sum_coverage(intervals: List[Tuple[float, float]]) -> float:
    return sum(max(0.0, b - a) for a, b in intervals)


def _close_perimeter(
    walls: List[Dict[str, Any]],
    *,
    thickness_px: float,
    edge_tol: float,
    gap_tol: float,
) -> Tuple[List[Dict[str, Any]], int]:
    """Cierra gaps pequeños del perímetro exterior (planos rectangulares típicos).

    Estrategia simple y robusta:
    - toma el bounding box de muros
    - detecta muros pegados a cada lado (top/bottom/left/right)
    - arma intervalos de cobertura y rellena huecos pequeños con nuevos muros
    """
    if not walls:
        return walls, 0

    rects = [(_rect(w), w) for w in walls]
    xs = [x for (x, _y, _w, _h), _ in rects]
    ys = [y for (_x, y, _w, _h), _ in rects]
    x2s = [x + w for (x, _y, w, _h), _ in rects]
    y2s = [y + h for (_x, y, _w, h), _ in rects]
    min_x = min(xs)
    min_y = min(ys)
    max_x = max(x2s)
    max_y = max(y2s)

    # Muy conservador para evitar "inventar" muros:
    # solo cerramos huecos pequeños entre segmentos ya existentes.
    side_tol = max(edge_tol, thickness_px * 0.55)
    close_gap = min(float(gap_tol), float(thickness_px) * 0.9)

    top = []
    bottom = []
    left = []
    right = []

    for w in walls:
        x, y, ww, hh = _rect(w)
        if ww <= 0 or hh <= 0:
            continue
        # borde superior
        if abs(y - min_y) <= side_tol:
            top.append((x, x + ww))
        # borde inferior
        if abs((y + hh) - max_y) <= side_tol:
            bottom.append((x, x + ww))
        # borde izquierdo
        if abs(x - min_x) <= side_tol:
            left.append((y, y + hh))
        # borde derecho
        if abs((x + ww) - max_x) <= side_tol:
            right.append((y, y + hh))

    top_m = _merge_intervals(top, gap_tol=close_gap)
    bottom_m = _merge_intervals(bottom, gap_tol=close_gap)
    left_m = _merge_intervals(left, gap_tol=close_gap)
    right_m = _merge_intervals(right, gap_tol=close_gap)

    span_x = max(1.0, max_x - min_x)
    span_y = max(1.0, max_y - min_y)

    # Si no hay evidencia fuerte de perímetro en un lado, no cerramos.
    need_top = _sum_coverage(top_m) >= span_x * 0.65
    need_bottom = _sum_coverage(bottom_m) >= span_x * 0.65
    need_left = _sum_coverage(left_m) >= span_y * 0.65
    need_right = _sum_coverage(right_m) >= span_y * 0.65

    added: List[Dict[str, Any]] = []
    added_count = 0

    def add_wall(*, x: float, y: float, w: float, h: float) -> None:
        nonlocal added_count
        if w < 3 or h < 3:
            return
        base: Dict[str, Any] = {
            "id": f"pp-{len(walls) + len(added) + 1}",
            "tipo": "muro",
            "x": float(x),
            "y": float(y),
            "width": float(w),
            "height": float(h),
            "rotation": 0.0,
        }
        added.append(base)
        added_count += 1

    # Rellenar huecos: buscamos gaps entre intervalos ya mergeados
    def fill_gaps_x(intervals: List[Tuple[float, float]], *, y: float, is_top: bool) -> None:
        if len(intervals) < 2:
            return
        for (a1, b1), (a2, _b2) in zip(intervals, intervals[1:]):
            gap = a2 - b1
            if 0 < gap <= close_gap:
                add_wall(x=b1, y=y, w=gap, h=thickness_px)

    def fill_gaps_y(intervals: List[Tuple[float, float]], *, x: float) -> None:
        if len(intervals) < 2:
            return
        for (a1, b1), (a2, _b2) in zip(intervals, intervals[1:]):
            gap = a2 - b1
            if 0 < gap <= close_gap:
                add_wall(x=x, y=b1, w=thickness_px, h=gap)

    if need_top:
        fill_gaps_x(top_m, y=min_y, is_top=True)
    if need_bottom:
        fill_gaps_x(bottom_m, y=max_y - thickness_px, is_top=False)
    if need_left:
        fill_gaps_y(left_m, x=min_x)
    if need_right:
        fill_gaps_y(right_m, x=max_x - thickness_px)

    if not added:
        return walls, 0

    return walls + added, added_count


def _intersection_area(a: Tuple[float, float, float, float], b: Tuple[float, float, float, float]) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    x0 = max(ax, bx)
    y0 = max(ay, by)
    x1 = min(ax + aw, bx + bw)
    y1 = min(ay + ah, by + bh)
    w = x1 - x0
    h = y1 - y0
    if w <= 0 or h <= 0:
        return 0.0
    return w * h


def _prune_overlapping_walls(walls: List[Dict[str, Any]], *, thickness_px: float, edge_tol: float) -> List[Dict[str, Any]]:
    """Elimina muros duplicados/encimados.

    Si dos muros se solapan fuerte y tienen grosor similar, se conserva el más largo.
    """
    if len(walls) < 2:
        return walls

    rects = [(_rect(w), w) for w in walls]
    keep = [True] * len(rects)

    tol_t = max(edge_tol, thickness_px * 0.35)
    for i in range(len(rects)):
        if not keep[i]:
            continue
        ri, _wi = rects[i]
        ix, iy, iw, ih = ri
        if iw <= 0 or ih <= 0:
            keep[i] = False
            continue
        ori_i = _orientation(iw, ih)
        ti = _thickness(iw, ih)
        li = _length(iw, ih)
        area_i = max(1.0, iw * ih)

        for j in range(i + 1, len(rects)):
            if not keep[j]:
                continue
            rj, _wj = rects[j]
            jx, jy, jw, jh = rj
            if jw <= 0 or jh <= 0:
                keep[j] = False
                continue

            ori_j = _orientation(jw, jh)
            if ori_i != ori_j:
                continue
            tj = _thickness(jw, jh)
            if abs(ti - tj) > tol_t:
                continue

            inter = _intersection_area(ri, rj)
            if inter <= 0:
                continue

            area_j = max(1.0, jw * jh)
            overlap = inter / min(area_i, area_j)
            if overlap < 0.85:
                continue

            lj = _length(jw, jh)
            if li >= lj:
                keep[j] = False
            else:
                keep[i] = False
                break

    return [w for ok, (_r, w) in zip(keep, rects) if ok]


def postprocess_vector_data(vector_data: Any) -> Tuple[List[Dict[str, Any]], Optional[PostprocessStats]]:
    """Mejora la coherencia geométrica de muros/puertas/ventanas.

    - Normaliza grosor de muros (mediana)
    - Alinea bordes (snap) para que muros conecten mejor
    - Une segmentos colineales con gaps pequeños

    No elimina otros tipos (texto/cota/simbolo).
    """
    if not isinstance(vector_data, list):
        return [], None

    items: List[Dict[str, Any]] = [it for it in vector_data if isinstance(it, dict)]

    walls = [it for it in items if str(it.get("tipo") or "").lower() == "muro"]
    non_walls = [it for it in items if str(it.get("tipo") or "").lower() != "muro"]

    if not walls:
        return items, None

    # Filter obviously broken walls
    clean_walls: List[Dict[str, Any]] = []
    thicknesses: List[float] = []
    for w in walls:
        x, y, ww, hh = _rect(w)
        if ww < 3 or hh < 3:
            continue
        t = _thickness(ww, hh)
        # ignore very thick blobs
        if 2 <= t <= 120:
            thicknesses.append(t)
        clean_walls.append(dict(w))

    if not clean_walls:
        return items, None

    typical_t = float(median(thicknesses)) if thicknesses else float(median([_thickness(*_rect(w)[2:]) for w in clean_walls]))
    typical_t = max(6.0, min(60.0, typical_t))

    # Snap/merge params based on thickness
    edge_tol = max(3.0, min(10.0, typical_t * 0.35))
    gap_tol = max(4.0, min(14.0, typical_t * 0.65))

    # Collect edges
    x_edges: List[float] = []
    y_edges: List[float] = []
    for w in clean_walls:
        x, y, ww, hh = _rect(w)
        x_edges.extend([x, x + ww])
        y_edges.extend([y, y + hh])

    x_clusters = _edge_clusters(x_edges, tol=edge_tol)
    y_clusters = _edge_clusters(y_edges, tol=edge_tol)

    normalized: List[Dict[str, Any]] = []

    for w in clean_walls:
        x, y, ww, hh = _rect(w)
        orient = _orientation(ww, hh)
        # snap edges
        x1 = _snap_to_clusters(x, x_clusters, edge_tol)
        y1 = _snap_to_clusters(y, y_clusters, edge_tol)
        x2 = _snap_to_clusters(x + ww, x_clusters, edge_tol)
        y2 = _snap_to_clusters(y + hh, y_clusters, edge_tol)

        nx = min(x1, x2)
        ny = min(y1, y2)
        nw = max(1.0, abs(x2 - x1))
        nh = max(1.0, abs(y2 - y1))

        # normalize thickness to typical
        if orient == "h":
            nh = typical_t
        else:
            nw = typical_t

        out = dict(w)
        out["x"] = float(nx)
        out["y"] = float(ny)
        out["width"] = float(nw)
        out["height"] = float(nh)
        # snap rotation to axis
        if "rotation" in out:
            try:
                rot = float(out.get("rotation") or 0)
            except Exception:
                rot = 0.0
            out["rotation"] = 0.0 if abs(rot) < 1e-3 else 0.0
        normalized.append(out)

    # Separate by orientation for merging
    horiz = [w for w in normalized if _orientation(*_rect(w)[2:]) == "h"]
    vert = [w for w in normalized if _orientation(*_rect(w)[2:]) == "v"]

    # Align tolerance: allow small y differences
    merged_h = _merge_segments(horiz, orient="h", gap_tol=gap_tol, align_tol=edge_tol)
    merged_v = _merge_segments(vert, orient="v", gap_tol=gap_tol, align_tol=edge_tol)

    walls_merged = merged_h + merged_v
    walls_closed, perimeter_added = _close_perimeter(
        walls_merged,
        thickness_px=typical_t,
        edge_tol=edge_tol,
        gap_tol=gap_tol,
    )

    walls_closed = _prune_overlapping_walls(walls_closed, thickness_px=typical_t, edge_tol=edge_tol)

    # Post-proceso de cotas: alinear con bordes y despegar de muros
    wall_rects = [_rect(w) for w in walls_closed]
    # Recalcular clusters usando muros ya cerrados para mejor snap
    x_edges2: List[float] = []
    y_edges2: List[float] = []
    for w in walls_closed:
        x, y, ww, hh = _rect(w)
        x_edges2.extend([x, x + ww])
        y_edges2.extend([y, y + hh])
    x_clusters2 = _edge_clusters(x_edges2, tol=edge_tol)
    y_clusters2 = _edge_clusters(y_edges2, tol=edge_tol)

    non_walls_pp, cotas_snapped = _postprocess_cotas(
        non_walls,
        wall_rects=wall_rects,
        x_clusters=x_clusters2,
        y_clusters=y_clusters2,
        edge_tol=edge_tol,
        thickness_px=typical_t,
    )

    result = walls_closed + non_walls_pp

    stats = PostprocessStats(
        walls_in=len(walls),
        walls_out=len(walls_closed),
        thickness_px=typical_t,
        perimeter_added=perimeter_added,
        cotas_snapped=cotas_snapped,
    )

    return result, stats
