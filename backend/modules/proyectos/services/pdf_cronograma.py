import io
import os
from datetime import date
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT


# ─── Paleta de colores ────────────────────────────────────────────────────────
DARK_BG    = colors.HexColor('#0F172A')
ACCENT     = colors.HexColor('#0EA5E9')
ACCENT2    = colors.HexColor('#38BDF8')
LIGHT_BG   = colors.HexColor('#F0F9FF')
BORDER     = colors.HexColor('#BAE6FD')
TEXT_DARK  = colors.HexColor('#0F172A')
TEXT_GREY  = colors.HexColor('#475569')
TEXT_LIGHT = colors.HexColor('#94A3B8')
WHITE      = colors.white
WARN       = colors.HexColor('#EF4444')   # rojo crítico
WARN_BG    = colors.HexColor('#FEE2E2')

FASE_COLORS = {
    1: colors.HexColor('#0EA5E9'),   # azul  - Obra Gruesa
    2: colors.HexColor('#8B5CF6'),   # violeta - Curado
    3: colors.HexColor('#10B981'),   # verde  - Acabados
    4: colors.HexColor('#F59E0B'),   # ámbar  - Buffer
}
FASE_COLORS_LIGHT = {
    1: colors.HexColor('#E0F2FE'),
    2: colors.HexColor('#EDE9FE'),
    3: colors.HexColor('#D1FAE5'),
    4: colors.HexColor('#FEF3C7'),
}


def _estilo():
    s = getSampleStyleSheet()

    def ps(name, **kwargs):
        return ParagraphStyle(name, parent=s['Normal'], **kwargs)

    return {
        'titulo':      ps('TIT',  fontSize=18, textColor=WHITE,      fontName='Helvetica-Bold',   spaceAfter=2,  alignment=TA_CENTER),
        'subtitulo':   ps('SUB',  fontSize=9,  textColor=ACCENT2,    fontName='Helvetica',         spaceAfter=0,  alignment=TA_CENTER),
        'label':       ps('LBL',  fontSize=8,  textColor=TEXT_LIGHT, fontName='Helvetica',         spaceAfter=0),
        'body':        ps('BOD',  fontSize=9,  textColor=TEXT_DARK,  fontName='Helvetica',         spaceAfter=0, leading=13),
        'body_grey':   ps('BGRY', fontSize=8,  textColor=TEXT_GREY,  fontName='Helvetica',         spaceAfter=0),
        'fase_titulo': ps('FTT',  fontSize=12, textColor=WHITE,      fontName='Helvetica-Bold',    spaceAfter=0),
        'sem_titulo':  ps('STT',  fontSize=10, textColor=TEXT_DARK,  fontName='Helvetica-Bold',    spaceAfter=0),
        'act':         ps('ACT',  fontSize=8,  textColor=TEXT_DARK,  fontName='Helvetica',         spaceAfter=0, leading=12),
        'mat':         ps('MAT',  fontSize=7.5,textColor=TEXT_GREY,  fontName='Helvetica-Oblique', spaceAfter=0),
        'nota_crit':   ps('NCR',  fontSize=7.5,textColor=WARN,       fontName='Helvetica-Bold',    spaceAfter=0),
        'cat_titulo':  ps('CTT',  fontSize=9,  textColor=WHITE,      fontName='Helvetica-Bold',    spaceAfter=0),
        'footer':      ps('FTR',  fontSize=7,  textColor=TEXT_LIGHT, fontName='Helvetica',         alignment=TA_CENTER),
    }


def _header(proyecto, styles):
    """Banner oscuro superior con nombre del proyecto."""
    hdr = Table(
        [
            [Paragraph("CRONOGRAMA DE EJECUCIÓN DE OBRA", styles['titulo'])],
            [Paragraph(
                f"Proyecto: {proyecto.titulo} · Fecha: {date.today().strftime('%d/%m/%Y')} · Duración: 10 Semanas",
                styles['subtitulo']
            )],
        ],
        colWidths=[19 * cm],
    )
    hdr.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), DARK_BG),
        ('TOPPADDING',    (0, 0), (-1, 0), 18),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
        ('TOPPADDING',    (0, 1), (-1, 1), 0),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 14),
        ('LEFTPADDING',  (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
    ]))
    return [hdr]


def _barra_semanas():
    """Barra visual con las 10 semanas y sus fases."""
    cols = 10
    semana_data = [[Paragraph(f"S{i+1}", ParagraphStyle('sw', parent=getSampleStyleSheet()['Normal'],
                                                           fontSize=7, textColor=WHITE, fontName='Helvetica-Bold',
                                                           alignment=TA_CENTER)) for i in range(cols)]]
    col_width = 19 * cm / cols
    t = Table(semana_data, colWidths=[col_width] * cols, rowHeights=[18])

    fase_ranges = [(1, 3, 1), (4, 6, 2), (7, 9, 3), (10, 10, 4)]
    styles_list = []
    for start, end, fase_num in fase_ranges:
        c = FASE_COLORS[fase_num]
        styles_list += [
            ('BACKGROUND', (start-1, 0), (end-1, 0), c),
        ]
    styles_list += [
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#1E293B')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]
    t.setStyle(TableStyle(styles_list))
    return t


def _leyenda_fases(styles):
    fase_nombres = {1: 'Obra Gruesa', 2: 'Curado/Revoques', 3: 'Acabados', 4: 'Buffer'}
    items = []
    for n, nombre in fase_nombres.items():
        c = FASE_COLORS[n]
        bloque = Table([[Paragraph(f"  Fase {n}: {nombre}  ", ParagraphStyle('lg', parent=getSampleStyleSheet()['Normal'],
                                                                              fontSize=7, textColor=WHITE, fontName='Helvetica-Bold'))]], colWidths=[3.5 * cm])
        bloque.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), c),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ]))
        items.append(bloque)

    row = Table([items], colWidths=[4 * cm] * 4)
    row.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
    ]))
    return row


def _tabla_semana(semana_data, fase_num, styles):
    """Genera la tabla de una semana."""
    s_num   = semana_data.get('semana', '?')
    s_tit   = semana_data.get('titulo', f'Semana {s_num}')
    critico = semana_data.get('critico', False)
    acts    = semana_data.get('actividades', [])

    fase_c      = FASE_COLORS[fase_num]
    fase_c_light = FASE_COLORS_LIGHT[fase_num]

    # Cabecera de semana
    cabecera_text = f"{'⚠ ' if critico else ''}  {s_tit}"
    cabecera = Paragraph(cabecera_text, styles['sem_titulo'])

    header_row = [cabecera, Paragraph("Materiales / Recursos", styles['body_grey']), Paragraph("Notas", styles['body_grey'])]

    rows = [header_row]
    for a in acts:
        desc   = a.get('descripcion', '')
        mats   = a.get('materiales', '-')
        nota   = a.get('notas', '')
        es_crit = 'CRÍTICO' in nota.upper()

        rows.append([
            Paragraph(f"• {desc}", styles['act']),
            Paragraph(mats, styles['mat']),
            Paragraph(nota, styles['nota_crit'] if es_crit else styles['mat']),
        ])

    t = Table(rows, colWidths=[7.5 * cm, 6.5 * cm, 5 * cm], repeatRows=1)

    ts = [
        # Cabecera
        ('BACKGROUND', (0, 0), (-1, 0), fase_c_light),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('TEXTCOLOR', (0, 0), (-1, 0), fase_c),
        ('TOPPADDING', (0, 0), (-1, 0), 7),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 7),
        ('LEFTPADDING', (0, 0), (-1, 0), 8),
        # Filas de actividades
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8FAFC')),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('LEFTPADDING', (0, 1), (-1, -1), 8),
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('BOX', (0, 0), (-1, -1), 1.5, fase_c),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        # Alternado de colores
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F0F9FF')]),
    ]

    if critico:
        ts += [
            ('BACKGROUND', (0, 0), (0, 0), WARN_BG),
            ('TEXTCOLOR', (0, 0), (0, 0), WARN),
        ]

    t.setStyle(TableStyle(ts))
    return t


def _seccion_materiales(materiales_completos, styles):
    """Tabla de materiales completos por categoría."""
    elements = []
    elements.append(Spacer(1, 14))

    titulo_mat = Table(
        [[Paragraph("📋  LISTA COMPLETA DE MATERIALES POR CATEGORÍA", styles['fase_titulo'])]],
        colWidths=[19 * cm]
    )
    titulo_mat.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), DARK_BG),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(titulo_mat)
    elements.append(Spacer(1, 4))

    # Dividir en 2 columnas
    half = len(materiales_completos) // 2 + len(materiales_completos) % 2
    col1 = materiales_completos[:half]
    col2 = materiales_completos[half:]

    def _col_tabla(cats, col_w):
        rows = []
        for cat in cats:
            cat_nombre = cat.get('categoria', '')
            items = cat.get('items', [])
            rows.append([Paragraph(cat_nombre.upper(), styles['cat_titulo'])])
            for item in items:
                rows.append([Paragraph(f"  ✓  {item}", styles['body'])])

        t = Table(rows, colWidths=[col_w])
        ts_rules = []
        row_idx = 0
        for cat in cats:
            ts_rules += [
                ('BACKGROUND', (0, row_idx), (-1, row_idx), ACCENT),
                ('TOPPADDING', (0, row_idx), (-1, row_idx), 4),
                ('BOTTOMPADDING', (0, row_idx), (-1, row_idx), 4),
                ('LEFTPADDING', (0, row_idx), (-1, row_idx), 8),
            ]
            row_idx += 1
            for _ in cat.get('items', []):
                ts_rules += [
                    ('TOPPADDING', (0, row_idx), (-1, row_idx), 3),
                    ('BOTTOMPADDING', (0, row_idx), (-1, row_idx), 3),
                    ('LEFTPADDING', (0, row_idx), (-1, row_idx), 8),
                    ('BACKGROUND', (0, row_idx), (-1, row_idx),
                     colors.white if row_idx % 2 == 0 else colors.HexColor('#F0F9FF')),
                ]
                row_idx += 1
        ts_rules += [
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]
        t.setStyle(TableStyle(ts_rules))
        return t

    c1 = _col_tabla(col1, 9.2 * cm)
    c2 = _col_tabla(col2, 9.2 * cm)

    mat_table = Table([[c1, c2]], colWidths=[9.4 * cm, 9.6 * cm])
    mat_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(mat_table)
    return elements


def _seccion_riesgos(riesgos, styles):
    elements = []
    elements.append(Spacer(1, 14))

    titulo_riesgos = Table(
        [[Paragraph("⚠  ANÁLISIS DE RIESGOS CLIMÁTICOS Y MITIGACIÓN", styles['fase_titulo'])]],
        colWidths=[19 * cm]
    )
    titulo_riesgos.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#7C3AED')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(titulo_riesgos)
    elements.append(Spacer(1, 4))

    header = [
        Paragraph("Riesgo", ParagraphStyle('rh', parent=getSampleStyleSheet()['Normal'], fontSize=8, textColor=WHITE, fontName='Helvetica-Bold')),
        Paragraph("Impacto", ParagraphStyle('rh2', parent=getSampleStyleSheet()['Normal'], fontSize=8, textColor=WHITE, fontName='Helvetica-Bold', alignment=TA_CENTER)),
        Paragraph("Plan de Mitigación", ParagraphStyle('rh3', parent=getSampleStyleSheet()['Normal'], fontSize=8, textColor=WHITE, fontName='Helvetica-Bold')),
    ]
    rows = [header]
    for r in riesgos:
        impacto = r.get('impacto', 'Medio')
        imp_color = WARN if impacto == 'Alto' else colors.HexColor('#F59E0B') if impacto == 'Medio' else colors.HexColor('#10B981')
        rows.append([
            Paragraph(r.get('riesgo', ''), styles['body']),
            Paragraph(impacto, ParagraphStyle('imp', parent=getSampleStyleSheet()['Normal'], fontSize=8,
                                              textColor=imp_color, fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(r.get('mitigacion', ''), styles['body']),
        ])

    t = Table(rows, colWidths=[5 * cm, 2.5 * cm, 11.5 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4C1D95')),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F3FF')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DDD6FE')),
        ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor('#7C3AED')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(t)
    return elements


def crear_pdf_cronograma(proyecto, datos_json):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=2 * cm,
    )

    styles = _estilo()
    elements = []

    # ── Header ─────────────────────────────────────────────────────────────────
    elements += _header(proyecto, styles)
    elements.append(Spacer(1, 8))

    # ── Barra de Gantt visual ──────────────────────────────────────────────────
    elements.append(_barra_semanas())
    elements.append(Spacer(1, 3))
    elements.append(_leyenda_fases(styles))
    elements.append(Spacer(1, 14))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    elements.append(Spacer(1, 8))

    # ── Fases y Semanas ────────────────────────────────────────────────────────
    fases = datos_json.get('fases', [])
    for fase in fases:
        fase_num   = fase.get('numero', 1)
        fase_tit   = fase.get('titulo', f'Fase {fase_num}')
        fase_color = FASE_COLORS.get(fase_num, ACCENT)

        # Cabecera de fase
        hdr_fase = Table(
            [[Paragraph(f"  {fase_tit}  ", styles['fase_titulo'])]],
            colWidths=[19 * cm]
        )
        hdr_fase.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), fase_color),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('ROUNDEDCORNERS', [4]),
        ]))
        elements.append(KeepTogether([hdr_fase]))
        elements.append(Spacer(1, 6))

        semanas = fase.get('semanas', [])
        for semana in semanas:
            t_sem = _tabla_semana(semana, fase_num, styles)
            elements.append(KeepTogether([t_sem]))
            elements.append(Spacer(1, 8))

        elements.append(Spacer(1, 6))

    # ── Materiales Completos ───────────────────────────────────────────────────
    materiales = datos_json.get('materiales_completos', [])
    if materiales:
        elements += _seccion_materiales(materiales, styles)

    # ── Riesgos ───────────────────────────────────────────────────────────────
    riesgos = datos_json.get('riesgos_climaticos', [])
    if riesgos:
        elements += _seccion_riesgos(riesgos, styles)

    # ── Footer ─────────────────────────────────────────────────────────────────
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=TEXT_LIGHT))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        f"Documento generado automáticamente por el Asistente IA Autónomo  ·  {date.today().strftime('%d de %B de %Y')}  ·  Proyecto: {proyecto.titulo}",
        styles['footer']
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer
