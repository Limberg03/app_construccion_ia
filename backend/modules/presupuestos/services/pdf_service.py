import io
from django.utils import timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generar_pdf_presupuesto(presupuesto):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    elements = []
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=20,
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#475569'),
        spaceAfter=30,
    )

    # Header
    elements.append(Paragraph("<b>Reporte de Presupuesto Estimado</b>", title_style))
    
    # Info Proyecto
    proyecto_nombre = presupuesto.proyecto.titulo if presupuesto.proyecto else "Proyecto Sin Nombre"
    fecha = timezone.now().strftime("%d/%m/%Y %H:%M")
    
    info_text = f"<b>Proyecto:</b> {proyecto_nombre}<br/>"
    info_text += f"<b>Presupuesto ID:</b> #{presupuesto.id}<br/>"
    info_text += f"<b>Fecha de Generación:</b> {fecha}<br/>"
    
    elements.append(Paragraph(info_text, subtitle_style))
    elements.append(Spacer(1, 10))

    # Table Data
    data = [['Material', 'Unidad', 'Cantidad', 'Precio Unitario (Bs)', 'Subtotal (Bs)']]
    
    total = 0
    for item in presupuesto.items.all().select_related("material"):
        subtotal = item.subtotal
        total += subtotal
        data.append([
            item.material.nombre,
            item.material.unidad or 'u',
            f"{item.cantidad:.2f}",
            f"{item.precio_unitario:.2f}",
            f"{subtotal:.2f}"
        ])
        
    data.append(['', '', '', 'TOTAL ESTIMADO', f"Bs {total:.2f}"])

    # Table Style
    t = Table(data, colWidths=[200, 60, 70, 100, 100])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0EA5E9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'), # Material left aligned
        ('ALIGN', (2, 1), (-1, -1), 'RIGHT'), # Numbers right aligned
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -2), colors.HexColor('#F8FAFC')),
        ('GRID', (0, 0), (-1, -2), 1, colors.HexColor('#E2E8F0')),
        
        # Total row style
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#E0F2FE')),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#0369A1')),
        ('TOPPADDING', (0, -1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 8),
        ('GRID', (-2, -1), (-1, -1), 1, colors.HexColor('#7DD3FC')),
    ]))
    
    elements.append(t)

    # Footer note
    elements.append(Spacer(1, 30))
    note_style = ParagraphStyle(
        'Note',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#94A3B8'),
    )
    elements.append(Paragraph("Nota: Este presupuesto es una estimación generada automáticamente por IA en base a planos vectoriales. Los precios están sujetos a variaciones del mercado.", note_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer
