import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Arc, Circle, Group, Layer, Line, Path, Rect, Stage, Text, Transformer } from 'react-konva'

const DEFAULT_METROS_POR_PIXEL = 0.01
const ESPESOR_M = {
  muro: 0.2,
  puerta: 0.15,
  ventana: 0.1,
}

function espesorPxPorTipo(tipo, pxPorMetro) {
  const m = ESPESOR_M[tipo]
  return Number.isFinite(m) ? m * pxPorMetro : null
}

function tieneEspesorFijo(tipo) {
  return tipo === 'muro' || tipo === 'puerta' || tipo === 'ventana'
}

function isTipoRect(tipo) {
  return tipo === 'muro' || tipo === 'puerta' || tipo === 'ventana'
}

// ── Paths SVG mejorados para símbolos (bounding box ~100×70) ──────────────
function symbolPathByName(nombre) {
  const key = String(nombre || '').trim().toLowerCase()

  // Cama doble: base + cabecera + dos almohadas
  if (key === 'cama') {
    return [
      'M4 14 H96 V66 H4 Z',          // base
      'M4 14 H96 V24 H4 Z',          // cabecera
      'M8 28 H44 V48 H8 Z',          // almohada izq
      'M56 28 H92 V48 H56 Z',        // almohada der
    ].join(' ')
  }

  // Inodoro: tanque rectangular + taza ovalada
  if (key === 'inodoro' || key === 'wc') {
    return [
      'M30 4 H70 V20 H30 Z',         // tanque
      'M26 20 C26 16 74 16 74 20 L74 46 C74 60 26 60 26 46 Z',  // taza
    ].join(' ')
  }

  // Auto (vista superior simplificada): carrocería + techo + ruedas
  if (key === 'auto' || key === 'carro' || key === 'coche') {
    return [
      'M10 44 H90 V58 H10 Z',
      'M25 44 L35 28 H65 L75 44 Z',
      'M25 58 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0',
      'M75 58 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0',
    ].join(' ')
  }

  // Escalera/Gradas: perfil en "L" con peldaños
  if (key === 'escalera' || key === 'gradas' || key === 'escaleras') {
    return [
      'M12 60 H38 V50 H48 V40 H58 V30 H68 V20 H92 V12 H82 V18 H64 V28 H54 V38 H44 V48 H34 V60 H12 Z',
    ].join(' ')
  }

  return null
}

// ── Color por símbolo (fill + stroke) ────────────────────────────────────
function symbolColors(nombre, isDark) {
  const key = String(nombre || '').trim().toLowerCase()
  if (key === 'cama') {
    return isDark
      ? { fill: '#1E3A5F', stroke: '#38BDF8', bg: 'rgba(56,189,248,0.10)' }
      : { fill: '#DBEAFE', stroke: '#2563EB', bg: 'rgba(37,99,235,0.10)' }
  }
  if (key === 'inodoro' || key === 'wc') {
    return isDark
      ? { fill: '#1E3A3A', stroke: '#34D399', bg: 'rgba(52,211,153,0.10)' }
      : { fill: '#D1FAE5', stroke: '#059669', bg: 'rgba(5,150,105,0.10)' }
  }
  if (key === 'auto' || key === 'carro' || key === 'coche') {
    return isDark
      ? { fill: '#0B1220', stroke: '#F59E0B', bg: 'rgba(245,158,11,0.10)' }
      : { fill: '#FEF3C7', stroke: '#B45309', bg: 'rgba(180,83,9,0.10)' }
  }
  if (key === 'escalera' || key === 'gradas' || key === 'escaleras') {
    return isDark
      ? { fill: '#111827', stroke: '#A78BFA', bg: 'rgba(167,139,250,0.10)' }
      : { fill: '#EDE9FE', stroke: '#6D28D9', bg: 'rgba(109,40,217,0.10)' }
  }
  // fallback
  return isDark
    ? { fill: '#1E293B', stroke: '#94A3B8', bg: 'rgba(148,163,184,0.10)' }
    : { fill: '#F1F5F9', stroke: '#475569', bg: 'rgba(71,85,105,0.10)' }
}

function cotaTicks({ x1, y1, x2, y2, tick = 10 }) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (!len) {
    return {
      a: [x1, y1, x1, y1],
      b: [x2, y2, x2, y2],
    }
  }

  // vector perpendicular normalizado
  const px = -dy / len
  const py = dx / len

  const ax1 = x1 - px * tick
  const ay1 = y1 - py * tick
  const ax2 = x1 + px * tick
  const ay2 = y1 + py * tick

  const bx1 = x2 - px * tick
  const by1 = y2 - py * tick
  const bx2 = x2 + px * tick
  const by2 = y2 + py * tick

  return {
    a: [ax1, ay1, ax2, ay2],
    b: [bx1, by1, bx2, by2],
  }
}

// Calcula el valor de la cota en metros a partir de las coordenadas en px
function calcularValorCota(x1, y1, x2, y2, metrosPorPixel) {
  const distPx = Math.hypot(x2 - x1, y2 - y1)
  const mpp = Number(metrosPorPixel) > 0 ? Number(metrosPorPixel) : DEFAULT_METROS_POR_PIXEL
  const metros = distPx * mpp
  return `${metros.toFixed(2)} m`
}

const ROTACION_SNAP_GRADOS = 45
const ROTACION_SNAPS = Array.from({ length: 360 / ROTACION_SNAP_GRADOS }, (_, i) => i * ROTACION_SNAP_GRADOS)

function normalizarGrados(grados) {
  const g = Number(grados) || 0
  const m = ((g % 360) + 360) % 360
  return m
}

function snapGrados(grados, paso = ROTACION_SNAP_GRADOS) {
  const g = normalizarGrados(grados)
  const snapped = Math.round(g / paso) * paso
  return normalizarGrados(snapped)
}

function normalizarFormas(json) {
  return Array.isArray(json) ? json : []
}

// Umbral de 4px: paredes que se tocan en esquina no se consideran conflicto
const OVERLAP_UMBRAL = 4
function rectangulosSeSolapan(a, b) {
  const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return ox > OVERLAP_UMBRAL && oy > OVERLAP_UMBRAL
}

// ── Snap magnético — usa las 4 ESQUINAS del muro (no centros de borde) ───────
const SNAP_RADIO = 20 // px
function extremosDeMuro(s) {
  const x = Number(s.x) || 0
  const y = Number(s.y) || 0
  const w = Number(s.width) || 0
  const h = Number(s.height) || 0
  // Las 4 esquinas del rectángulo — son los puntos de unión arquitectónicos
  return [
    { x: x, y: y },   // top-left
    { x: x + w, y: y },   // top-right
    { x: x, y: y + h },   // bottom-left
    { x: x + w, y: y + h },   // bottom-right
  ]
}
function calcularSnap(shapes, draggedId, candidateX, candidateY) {
  const dragged = shapes.find(s => s.id === draggedId)
  if (!dragged) return null
  const otrosMuros = shapes.filter(s => s.tipo === 'muro' && s.id !== draggedId)
  // Posición candidata del muro arrastrado
  const candidato = { ...dragged, x: candidateX, y: candidateY }
  const puntosCandidate = extremosDeMuro(candidato)
  let mejorDist = SNAP_RADIO, snapDx = 0, snapDy = 0, haySnap = false
  for (const otro of otrosMuros) {
    for (const ep of extremosDeMuro(otro)) {
      for (const cp of puntosCandidate) {
        const d = Math.hypot(cp.x - ep.x, cp.y - ep.y)
        if (d < mejorDist) {
          mejorDist = d
          // Delta para mover la posición del grupo completo
          snapDx = ep.x - cp.x
          snapDy = ep.y - cp.y
          haySnap = true
        }
      }
    }
  }
  return haySnap ? { x: candidateX + snapDx, y: candidateY + snapDy } : null
}

function clientRectDeNode(node) {
  if (!node?.getClientRect) return null
  const r = node.getClientRect({ skipTransform: false, skipStroke: true, skipShadow: true })
  return {
    x: Number(r.x) || 0,
    y: Number(r.y) || 0,
    width: Number(r.width) || 0,
    height: Number(r.height) || 0,
  }
}

function aMetros(px, metrosPorPixel = DEFAULT_METROS_POR_PIXEL) {
  const mpp = Number(metrosPorPixel) > 0 ? Number(metrosPorPixel) : DEFAULT_METROS_POR_PIXEL
  const v = Number(px) * mpp
  if (!Number.isFinite(v)) return 0
  return v
}

function descargarBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function sanitizarNombreArchivo(s) {
  const raw = String(s || '').trim() || 'plano'
  return raw
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

function colorPorTipoParaExport(tipo) {
  if (tipo === 'muro') return '#0F172A'
  if (tipo === 'puerta') return '#9333EA'
  if (tipo === 'ventana') return '#0284C7'
  return '#334155'
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const raw = String(text || '').trim()
  if (!raw) return 0
  const words = raw.split(/\s+/)
  let line = ''
  let lines = 0

  for (let i = 0; i < words.length; i += 1) {
    const testLine = line ? `${line} ${words[i]}` : words[i]
    const w = ctx.measureText(testLine).width
    if (w > maxWidth && line) {
      ctx.fillText(line, x, y)
      y += lineHeight
      lines += 1
      line = words[i]
      if (maxLines && lines >= maxLines) return lines
    } else {
      line = testLine
    }
  }

  if (line) {
    ctx.fillText(line, x, y)
    lines += 1
  }
  return lines
}

function crearCanvasPlanoProfesional({ stage, shapes, titulo, subtitulo, ubicacion, descripcion, metrosPorPixel }) {
  // PixelRatio dinámico: evita exports gigantes, pero mantiene detalle.
  const targetMaxSide = 5200
  const stageMax = Math.max(1, Number(stage?.width?.()) || 1, Number(stage?.height?.()) || 1)
  const pr = Math.round(targetMaxSide / stageMax)
  const pixelRatio = Math.max(2, Math.min(6, pr))

  const stageW = Number(stage?.width?.()) || 1
  const stageH = Number(stage?.height?.()) || 1

  const baseFull = stage.toCanvas({ pixelRatio })

  // Recorte al contenido (en coordenadas de canvas del Stage ya renderizado)
  const scale = Number(stage?.scaleX?.()) || 1
  const pos = stage?.position?.() || { x: 0, y: 0 }
  const pad = 40

  const pts = []
  for (const s of (Array.isArray(shapes) ? shapes : [])) {
    if (!s) continue
    if (s.tipo === 'muro' || s.tipo === 'puerta' || s.tipo === 'ventana') {
      const x = Number(s.x) || 0
      const y = Number(s.y) || 0
      const w = Number(s.width) || 0
      const h = Number(s.height) || 0
      if (w > 0 && h > 0) {
        pts.push([x, y], [x + w, y + h])
      }
    } else if (s.tipo === 'cota') {
      const x1 = Number(s.x1) || 0
      const y1 = Number(s.y1) || 0
      const x2 = Number(s.x2) || 0
      const y2 = Number(s.y2) || 0
      pts.push([x1, y1], [x2, y2])
    } else if (s.tipo === 'texto') {
      const x = Number(s.x) || 0
      const y = Number(s.y) || 0
      const fs = Number(s.tamano_fuente) || 16
      const txt = String(s.texto || '')
      const w = Math.max(60, txt.length * fs * 0.6 + 16)
      const h = fs + 14
      pts.push([x - 8, y - 6], [x - 8 + w, y - 6 + h])
    } else if (s.tipo === 'simbolo') {
      const x = Number(s.x) || 0
      const y = Number(s.y) || 0
      const sc = Number(s.escala) || 1
      pts.push([x - 4, y - 4], [x - 4 + 108 * sc, y - 4 + 78 * sc])
    }
  }

  let minX = 0, minY = 0, maxX = stageW, maxY = stageH
  if (pts.length) {
    const screen = pts.map(([x, y]) => [x * scale + pos.x, y * scale + pos.y])
    minX = Math.max(0, Math.min(...screen.map(p => p[0])) - pad)
    minY = Math.max(0, Math.min(...screen.map(p => p[1])) - pad)
    maxX = Math.min(stageW, Math.max(...screen.map(p => p[0])) + pad)
    maxY = Math.min(stageH, Math.max(...screen.map(p => p[1])) + pad)
  }

  const cropX = Math.floor(minX * pixelRatio)
  const cropY = Math.floor(minY * pixelRatio)
  const cropW = Math.max(1, Math.floor((maxX - minX) * pixelRatio))
  const cropH = Math.max(1, Math.floor((maxY - minY) * pixelRatio))

  const baseCanvas = document.createElement('canvas')
  baseCanvas.width = cropW
  baseCanvas.height = cropH
  const bctx = baseCanvas.getContext('2d')
  bctx.drawImage(baseFull, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

  const mpp = Number(metrosPorPixel) > 0 ? Number(metrosPorPixel) : DEFAULT_METROS_POR_PIXEL
  const pxPorMetro = 1 / mpp

  const margin = Math.round(24 * pixelRatio)
  const panelW = Math.round(360 * pixelRatio)
  const w = baseCanvas.width + margin * 2 + panelW
  const h = baseCanvas.height + margin * 2

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')

  // Fondo
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, w, h)

  // Marco exterior
  ctx.strokeStyle = '#0F172A'
  ctx.lineWidth = 2 * pixelRatio
  ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2)

  // Separador panel derecho
  const panelX = margin + baseCanvas.width
  ctx.strokeStyle = '#CBD5E1'
  ctx.lineWidth = 1 * pixelRatio
  ctx.beginPath()
  ctx.moveTo(panelX, margin)
  ctx.lineTo(panelX, h - margin)
  ctx.stroke()

  // Plano (área de dibujo)
  const planoX = margin
  const planoY = margin
  ctx.drawImage(baseCanvas, planoX, planoY)

  // Panel derecho (cajetín)
  const cajX = panelX
  const cajY = margin
  const cajW = panelW
  const cajH = h - margin * 2
  ctx.fillStyle = '#F8FAFC'
  ctx.fillRect(cajX, cajY, cajW, cajH)
  ctx.strokeStyle = '#CBD5E1'
  ctx.lineWidth = 1 * pixelRatio
  ctx.strokeRect(cajX, cajY, cajW, cajH)

  // Tipografía
  const px = cajX + Math.round(16 * pixelRatio)
  let py = cajY + Math.round(26 * pixelRatio)
  const line = Math.round(18 * pixelRatio)
  const font = (size, weight = 400) => {
    ctx.font = `${weight} ${size * pixelRatio}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`;
  }

  ctx.fillStyle = '#0F172A'
  font(11, 700)
  ctx.fillText(`Nombre de casa: ${String(titulo || 'Casa')}`, px, py)

  py += line
  font(10, 600)
  ctx.fillText('Ubicación:', px, py)
  font(10, 400)
  wrapText(
    ctx,
    String(ubicacion || ''),
    px + Math.round(70 * pixelRatio),
    py,
    Math.round(420 * pixelRatio),
    Math.round(16 * pixelRatio),
    2
  )

  py += line
  font(10, 600)
  ctx.fillText('Descripción:', px, py)
  font(10, 400)
  wrapText(
    ctx,
    String(descripcion || subtitulo || ''),
    px + Math.round(84 * pixelRatio),
    py,
    Math.round(420 * pixelRatio),
    Math.round(16 * pixelRatio),
    2
  )

  py += line
  font(10, 400)
  const fecha = new Date().toLocaleDateString('es-BO')
  ctx.fillText(`Fecha: ${fecha}`, px, py)

  py += line
  ctx.fillText(`Escala: 1 m = ${Math.round(pxPorMetro)} px`, px, py)

  // Bounding box
  const rects = shapes
    .filter(Boolean)
    .map((s) => ({
      x: Number(s.x) || 0,
      y: Number(s.y) || 0,
      w: Number(s.width) || 0,
      h: Number(s.height) || 0,
    }))
    .filter((r) => r.w > 0 && r.h > 0)

  if (rects.length) {
    const minX = Math.min(...rects.map((r) => r.x))
    const minY = Math.min(...rects.map((r) => r.y))
    const maxX = Math.max(...rects.map((r) => r.x + r.w))
    const maxY = Math.max(...rects.map((r) => r.y + r.h))
    const anchoM = aMetros(maxX - minX, mpp).toFixed(2)
    const altoM = aMetros(maxY - minY, mpp).toFixed(2)
    py += line
    ctx.fillText(`Tamaño aprox.: ${anchoM} m x ${altoM} m`, px, py)
  }

  // Conteo
  const counts = shapes.reduce(
    (acc, s) => {
      const t = s?.tipo || 'otro'
      acc[t] = (acc[t] || 0) + 1
      return acc
    },
    {}
  )

  // Leyenda + conteo (debajo de metadatos)
  const colX = px
  let colY = py + Math.round(28 * pixelRatio)
  font(10, 700)
  ctx.fillStyle = '#0F172A'
  ctx.fillText('Leyenda', colX, colY)
  colY += Math.round(16 * pixelRatio)

  const legend = [
    { tipo: 'muro', label: 'Muro' },
    { tipo: 'puerta', label: 'Puerta' },
    { tipo: 'ventana', label: 'Ventana' },
  ]

  legend.forEach((it) => {
    const c = colorPorTipoParaExport(it.tipo)
    ctx.fillStyle = c
    ctx.fillRect(colX, colY - Math.round(10 * pixelRatio), Math.round(14 * pixelRatio), Math.round(10 * pixelRatio))
    ctx.strokeStyle = '#0F172A'
    ctx.strokeRect(colX, colY - Math.round(10 * pixelRatio), Math.round(14 * pixelRatio), Math.round(10 * pixelRatio))
    ctx.fillStyle = '#0F172A'
    font(9, 500)
    ctx.fillText(it.label, colX + Math.round(20 * pixelRatio), colY)
    colY += Math.round(16 * pixelRatio)
  })

  colY += Math.round(6 * pixelRatio)
  font(10, 700)
  ctx.fillText('Elementos', colX, colY)
  colY += Math.round(16 * pixelRatio)
  font(9, 400)
  Object.entries(counts).forEach(([t, n]) => {
    ctx.fillText(`${t}: ${n}`, colX, colY)
    colY += Math.round(14 * pixelRatio)
  })

  // Barra de escala (abajo del panel)
  const barX = px
  const barY = cajY + cajH - Math.round(30 * pixelRatio)
  const segmentM = 1
  const segments = 5
  const segPx = pxPorMetro * pixelRatio * segmentM
  ctx.strokeStyle = '#0F172A'
  ctx.lineWidth = 2 * pixelRatio
  ctx.beginPath()
  ctx.moveTo(barX, barY)
  ctx.lineTo(barX + segPx * segments, barY)
  ctx.stroke()
  for (let i = 0; i <= segments; i += 1) {
    const x = barX + segPx * i
    ctx.beginPath()
    ctx.moveTo(x, barY - Math.round(6 * pixelRatio))
    ctx.lineTo(x, barY + Math.round(6 * pixelRatio))
    ctx.stroke()
    font(8, 500)
    ctx.fillStyle = '#0F172A'
    ctx.fillText(`${i * segmentM}m`, x - Math.round(6 * pixelRatio), barY - Math.round(10 * pixelRatio))
  }

  return out
}

export const CanvasBoard = forwardRef(function CanvasBoard(
  { 
    datosVectoriales, 
    onChange, 
    isDark, 
    escalaMetrosPorPixel,
    exportTitulo, 
    exportSubtitulo, 
    exportUbicacion, 
    exportDescripcion,
    onUndoChange,
    onRedoChange,
    onZoomChange,
  },
  ref,
) {
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const transformerRef = useRef(null)
  const shapeRefs = useRef({})
  const clipboardRef = useRef([])
  const [activeTool, setActiveTool] = useState('select') // 'select' | 'pan'
  const [size, setSize] = useState({ width: 300, height: 300 })
  const [selectedIds, setSelectedIds] = useState([])
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null

  const selectionListenersRef = useRef(new Set())
  const historyListenersRef = useRef(new Set())
  
  const [stageScale, setStageScale] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const [selectionRect, setSelectionRect] = useState(null)
  const selectionStartRef = useRef(null)

  // ── Editor de texto inline ────────────────────────────────────────────
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [editingPos, setEditingPos] = useState({ x: 0, y: 0, width: 180 })
  const textareaRef = useRef(null)
  const [idEnConflicto, setIdEnConflicto] = useState(null)
  const [modoExport, setModoExport] = useState(false)
  const [snapPos, setSnapPos] = useState(null)  // { x, y } del preview de snap

  const metrosPorPixel = useMemo(() => {
    const v = Number(escalaMetrosPorPixel)
    return v > 0 ? v : DEFAULT_METROS_POR_PIXEL
  }, [escalaMetrosPorPixel])

  const pxPorMetro = useMemo(() => 1 / metrosPorPixel, [metrosPorPixel])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const preventContext = (e) => e.preventDefault()
    el.addEventListener('contextmenu', preventContext)

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setSize({ width: Math.max(1, cr.width), height: Math.max(1, cr.height) })
    })

    ro.observe(el)
    return () => {
      el.removeEventListener('contextmenu', preventContext)
      ro.disconnect()
    }
  }, [])

  const shapes = useMemo(() => normalizarFormas(datosVectoriales), [datosVectoriales])

  const muroIndexById = useMemo(() => {
    const muros = shapes.filter((s) => s?.tipo === 'muro')
    const sorted = [...muros].sort((a, b) => String(a.id).localeCompare(String(b.id)))
    const map = new Map()
    sorted.forEach((s, i) => map.set(s.id, i + 1))
    return map
  }, [shapes])

  // ── Historial (Undo / Redo) ──────────────────────────────────────────
  const [history, setHistory] = useState([])
  const [historyStep, setHistoryStep] = useState(-1)

  useEffect(() => {
    const isNew = historyStep === -1 || JSON.stringify(datosVectoriales) !== JSON.stringify(history[historyStep])
    if (isNew) {
      setHistory([datosVectoriales])
      setHistoryStep(0)
    }
  }, [datosVectoriales, history, historyStep])

  const dispatchChange = useCallback((next) => {
    const newHistory = history.slice(0, historyStep + 1)
    newHistory.push(next)
    setHistory(newHistory)
    setHistoryStep(newHistory.length - 1)
    onChange?.(next)
  }, [history, historyStep, onChange])

  const undo = useCallback(() => {
    if (historyStep > 0) {
      const nextStep = historyStep - 1
      setHistoryStep(nextStep)
      onChange?.(history[nextStep])
    }
  }, [history, historyStep, onChange])

  const redo = useCallback(() => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1
      setHistoryStep(nextStep)
      onChange?.(history[nextStep])
    }
  }, [history, historyStep, onChange])

  // Notificar al parent cambios de undo/redo/zoom
  useEffect(() => {
    onUndoChange?.(historyStep > 0)
  }, [historyStep, onUndoChange])

  useEffect(() => {
    onRedoChange?.(historyStep < history.length - 1)
  }, [historyStep, history.length, onRedoChange])

  useEffect(() => {
    onZoomChange?.(`${(stageScale * 100).toFixed(0)}%`)
  }, [stageScale, onZoomChange])

  const selectedShape = useMemo(
    () => (selectedId ? shapes.find((s) => s.id === selectedId) : null),
    [selectedId, shapes]
  )

  useEffect(() => {
    selectionListenersRef.current.forEach((cb) => cb(selectedId))
  }, [selectedId])

  useEffect(() => {
    const payload = {
      canUndo: historyStep > 0,
      canRedo: historyStep < history.length - 1,
    }
    historyListenersRef.current.forEach((cb) => cb(payload))
  }, [historyStep, history.length])

  // ── Abrir editor de texto inline ─────────────────────────────────────
  const abrirEditorTexto = useCallback((s, nodeOrPos) => {
    const stageEl = stageRef.current?.container()
    const stageRect = stageEl?.getBoundingClientRect() ?? { left: 0, top: 0 }
    let sx = 0, sy = 0
    if (nodeOrPos?.getAbsolutePosition) {
      const abs = nodeOrPos.getAbsolutePosition()
      sx = stageRect.left + abs.x
      sy = stageRect.top + abs.y
    } else {
      sx = stageRect.left + (Number(s.x) || 0)
      sy = stageRect.top + (Number(s.y) || 0)
    }
    const currentText = s.tipo === 'cota' ? (s.valor || '') : (s.texto || '')
    setEditingId(s.id)
    setEditingText(currentText)
    setEditingPos({ x: sx, y: sy, width: 180 })
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [])

  const cerrarEditorTexto = useCallback((guardar = true) => {
    if (!editingId) return
    if (guardar) {
      // Actualizamos el JSON directamente sin pasar por actualizarForma
      // (se define en este componente) para evitar dependencia circular.
      const shape = shapes.find((ss) => ss.id === editingId)
      if (shape) {
        const patch =
          shape.tipo === 'cota' ? { valor: editingText } :
            shape.tipo === 'texto' ? { texto: editingText } :
              null
        if (patch) {
          const next = shapes.map((ss) => ss.id === editingId ? { ...ss, ...patch } : ss)
          dispatchChange(next)
        }
      }
    }
    setEditingId(null)
    setEditingText('')
  }, [editingId, editingText, shapes, dispatchChange])

  const muroTieneConflicto = (id, rectCandidate) => {
    if (!rectCandidate) return false
    return shapes.some((s) => {
      if (!s) return false
      if (s.id === id) return false
      if (s.tipo !== 'muro') return false
      const otherRect = {
        x: Number(s.x) || 0,
        y: Number(s.y) || 0,
        width: Number(s.width) || 0,
        height: Number(s.height) || 0,
      }
      return rectangulosSeSolapan(rectCandidate, otherRect)
    })
  }

  const actualizarForma = (id, patch) => {
    const actual = shapes.find((s) => s.id === id)
    if (!actual) return true

    const actualizado = { ...actual, ...patch }

    if (actualizado.tipo === 'muro') {
      const node = shapeRefs.current[id]
      const rect =
        clientRectDeNode(node) ??
        {
          x: Number(actualizado.x) || 0,
          y: Number(actualizado.y) || 0,
          width: Number(actualizado.width) || 0,
          height: Number(actualizado.height) || 0,
        }

      const haySolape = muroTieneConflicto(id, rect)
      if (haySolape) return false
    }

    const next = shapes.map((s) => (s.id === id ? actualizado : s))
    dispatchChange(next)
    return true
  }

  const aplicarRotacionSeleccion = (grados) => {
    if (!selectedId) return
    const rot = snapGrados(Number(grados) || 0)
    const ok = actualizarForma(selectedId, { rotation: rot })
    if (!ok) return
    const node = shapeRefs.current[selectedId]
    if (node) {
      node.rotation(rot)
      node.getLayer()?.batchDraw()
    }
  }

  const exportarJpg = async () => {
    const stage = stageRef.current
    if (!stage) return

    setModoExport(true)
    zoomToFit()
    // Esperamos a que React aplique el nuevo zoomToFit y modoExport antes de capturar el canvas
    await new Promise((r) => setTimeout(r, 150))

    const tr = transformerRef.current
    const prevVisible = tr?.visible?.() ?? true
    if (tr) {
      tr.nodes([])
      tr.visible(false)
      tr.getLayer()?.batchDraw()
    }

    const canvas = crearCanvasPlanoProfesional({
      stage,
      shapes,
      titulo: exportTitulo || 'Plano',
      subtitulo: exportSubtitulo || '',
      ubicacion: exportUbicacion || '',
      descripcion: exportDescripcion || '',
      metrosPorPixel,
    })

    if (tr) {
      tr.visible(prevVisible)
      tr.getLayer()?.batchDraw()
    }

    setModoExport(false)

    const name = sanitizarNombreArchivo(exportTitulo || 'plano')
    await new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) descargarBlob(blob, `${name}.jpg`)
          resolve()
        },
        'image/jpeg',
        0.98,
      )
    })
  }

  const exportarPdf = async () => {
    const stage = stageRef.current
    if (!stage) return

    setModoExport(true)
    zoomToFit()
    // Esperamos a que React aplique el nuevo zoomToFit y modoExport antes de capturar el canvas
    await new Promise((r) => setTimeout(r, 150))

    const tr = transformerRef.current
    const prevVisible = tr?.visible?.() ?? true
    if (tr) {
      tr.nodes([])
      tr.visible(false)
      tr.getLayer()?.batchDraw()
    }

    const canvas = crearCanvasPlanoProfesional({
      stage,
      shapes,
      titulo: exportTitulo || 'Plano',
      subtitulo: exportSubtitulo || '',
      ubicacion: exportUbicacion || '',
      descripcion: exportDescripcion || '',
      metrosPorPixel,
    })
    // PNG evita artefactos en líneas finas (más profesional)
    const imgData = canvas.toDataURL('image/png')

    if (tr) {
      tr.visible(prevVisible)
      tr.getLayer()?.batchDraw()
    }

    setModoExport(false)

    const { jsPDF } = await import('jspdf')
    // A3 para que entren detalles y textos con mejor legibilidad
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    const margin = 24
    const maxW = pageW - margin * 2
    const maxH = pageH - margin * 2
    const ratio = Math.min(maxW / canvas.width, maxH / canvas.height)
    const w = canvas.width * ratio
    const h = canvas.height * ratio
    const x = (pageW - w) / 2
    const y = (pageH - h) / 2

    pdf.addImage(imgData, 'PNG', x, y, w, h)

    const name = sanitizarNombreArchivo(exportTitulo || 'plano')
    pdf.save(`${name}.pdf`)
  }

  useImperativeHandle(ref, () => ({
    exportarJpg,
    exportarPdf,
    zoomToFit,
    zoomIn: () => setStageScale(s => Math.min(s * 1.2, 3)),
    zoomOut: () => setStageScale(s => Math.max(s / 1.2, 0.2)),
    getZoomLevel: () => `${(stageScale * 100).toFixed(0)}%`,
    undo,
    redo,
    canUndo: historyStep > 0,
    canRedo: historyStep < history.length - 1,
    getSelectedTypeId: () => selectedId,
    getShapes: () => shapes,
    addRectangle: ({ x, y, width, height, tipo, rotation = 0 }) => {
      const id = `${tipo || 'shape'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      const next = [
        ...shapes,
        { id, tipo, x, y, width, height, rotation },
      ]
      dispatchChange(next)
      return id
    },
    updateShape: (id, patch) => actualizarForma(id, patch),
    deleteShape: (id) => {
      const next = shapes.filter((s) => s.id !== id)
      dispatchChange(next)
      if (selectedIds.includes(id)) {
        setSelectedIds((prev) => prev.filter((s) => s !== id))
      }
    },
    onSelectionChange: (cb) => {
      if (typeof cb !== 'function') return () => {}
      selectionListenersRef.current.add(cb)
      return () => selectionListenersRef.current.delete(cb)
    },
    onHistoryChange: (cb) => {
      if (typeof cb !== 'function') return () => {}
      historyListenersRef.current.add(cb)
      return () => historyListenersRef.current.delete(cb)
    },
  }), [
    stageScale,
    historyStep,
    history.length,
    selectedId,
    shapes,
    selectedIds,
    dispatchChange,
    actualizarForma,
    undo,
    redo,
  ])

  const grid = useMemo(() => {
    const spacing = 50
    const lines = []

    // Grid fino (cada 50px)
    for (let x = 0; x <= size.width; x += spacing) {
      lines.push({ points: [x, 0, x, size.height], major: false })
    }
    for (let y = 0; y <= size.height; y += spacing) {
      lines.push({ points: [0, y, size.width, y], major: false })
    }

    // Grid principal cada metro (100px)
    for (let x = 0; x <= size.width; x += spacing * 2) {
      lines.push({ points: [x, 0, x, size.height], major: true })
    }
    for (let y = 0; y <= size.height; y += spacing * 2) {
      lines.push({ points: [0, y, size.width, y], major: true })
    }

    return lines
  }, [size.height, size.width])

  // Color del grid - muy sutil para tema técnico
  const gridColor = isDark ? '#1e293b' : '#e5e5e5'
  const gridColorMajor = isDark ? '#334155' : '#cccccc'

  // ── Teclado: Navegación, Eliminar y Deshacer/Rehacer ──────────
  useEffect(() => {
    const onKeyDown = (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT'
      if (isInput) return

      if (e.code === 'Space') {
        setIsSpaceDown(true)
        e.preventDefault()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          const next = shapes.filter(s => !selectedIds.includes(s.id))
          dispatchChange(next)
          setSelectedIds([])
        }
      }

      // Atajos de Herramienta
      if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey) setActiveTool('select')
      if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) setActiveTool('pan')

      // Ctrl + C (Copiar)
      if (e.key.toLowerCase() === 'c' && (e.ctrlKey || e.metaKey)) {
        if (selectedIds.length > 0) {
          const selectedShapes = shapes.filter(s => selectedIds.includes(s.id))
          clipboardRef.current = selectedShapes.map(s => ({ ...s }))
        }
      }

      // Ctrl + V (Pegar)
      if (e.key.toLowerCase() === 'v' && (e.ctrlKey || e.metaKey)) {
        if (clipboardRef.current && clipboardRef.current.length > 0) {
          const newShapes = clipboardRef.current.map(s => {
            const newId = `${s.tipo}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
            const obj = {
              ...s,
              id: newId,
              x: (Number(s.x) || 0) + 20,
              y: (Number(s.y) || 0) + 20,
            }
            if (s.x1 !== undefined) obj.x1 = (Number(s.x1) || 0) + 20
            if (s.y1 !== undefined) obj.y1 = (Number(s.y1) || 0) + 20
            if (s.x2 !== undefined) obj.x2 = (Number(s.x2) || 0) + 20
            if (s.y2 !== undefined) obj.y2 = (Number(s.y2) || 0) + 20
            return obj
          })
          
          dispatchChange([...shapes, ...newShapes])
          setSelectedIds(newShapes.map(s => s.id))
          clipboardRef.current = newShapes.map(s => ({ ...s })) // Preparar para el siguiente pegado
        }
      }

      // Ctrl + Z / Ctrl + Shift + Z
      if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey) redo()
        else undo()
        e.preventDefault()
      }
      // Ctrl + Y
      if (e.key.toLowerCase() === 'y' && (e.ctrlKey || e.metaKey)) {
        redo()
        e.preventDefault()
      }
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpaceDown(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [selectedIds, shapes, dispatchChange, undo, redo])

  const eliminarSeleccionado = () => {
    if (selectedIds.length === 0) return
    const next = shapes.filter(s => !selectedIds.includes(s.id))
    dispatchChange(next)
    setSelectedIds([])
  }

  // ── Handlers MultiDrag ────────────────────────────────────────────────────────
  const handleMultiDragMove = (e, draggedId) => {
    if (activeTool !== 'select') return
    if (!selectedIds.includes(draggedId)) return

    const node = e.target
    const draggedShape = shapes.find(s => s.id === draggedId)
    if (!draggedShape) return

    let dx = 0, dy = 0
    if (draggedShape.tipo === 'cota') {
      dx = node.x()
      dy = node.y()
    } else {
      dx = node.x() - (Number(draggedShape.x) || 0)
      dy = node.y() - (Number(draggedShape.y) || 0)
    }

    selectedIds.forEach(id => {
      if (id === draggedId) return
      const otherNode = shapeRefs.current[id]
      if (!otherNode) return
      const otherShape = shapes.find(s => s.id === id)
      if (!otherShape) return

      if (otherShape.tipo === 'cota') {
        otherNode.position({ x: dx, y: dy })
      } else {
        otherNode.position({ x: (Number(otherShape.x) || 0) + dx, y: (Number(otherShape.y) || 0) + dy })
      }
    })
  }

  const handleMultiDragEnd = (e, draggedId) => {
    if (activeTool !== 'select') return
    const node = e.target
    const draggedShape = shapes.find(s => s.id === draggedId)
    if (!draggedShape) return

    if (!selectedIds.includes(draggedId)) {
      const snapX = Math.round(node.x() / 10) * 10
      const snapY = Math.round(node.y() / 10) * 10
      if (draggedShape.tipo !== 'cota') {
        actualizarForma(draggedId, { x: snapX, y: snapY })
        node.position({ x: snapX, y: snapY })
      }
      return
    }

    let dx = 0, dy = 0
    if (draggedShape.tipo === 'cota') {
      dx = node.x()
      dy = node.y()
      node.position({ x: 0, y: 0 })
    } else {
      dx = node.x() - (Number(draggedShape.x) || 0)
      dy = node.y() - (Number(draggedShape.y) || 0)
    }

    const snapDx = Math.round(dx / 10) * 10
    const snapDy = Math.round(dy / 10) * 10

    const nextShapes = shapes.map(sh => {
      if (selectedIds.includes(sh.id)) {
        if (sh.tipo === 'cota') {
          return { ...sh, x1: (Number(sh.x1)||0) + snapDx, y1: (Number(sh.y1)||0) + snapDy, x2: (Number(sh.x2)||0) + snapDx, y2: (Number(sh.y2)||0) + snapDy }
        } else {
          return { ...sh, x: (Number(sh.x)||0) + snapDx, y: (Number(sh.y)||0) + snapDy }
        }
      }
      return sh
    })
    
    selectedIds.forEach(id => {
      const otherNode = shapeRefs.current[id]
      if (otherNode && shapes.find(s => s.id === id)?.tipo === 'cota') {
        otherNode.position({ x: 0, y: 0 })
      }
    })

    dispatchChange(nextShapes)
  }

  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return

    const run = () => {
      const nodes = selectedIds
        .map(id => shapeRefs.current[id])
        .filter(Boolean)
        .filter(node => isTipoRect(shapes.find(s => s.id === node.attrs.id)?.tipo || 'muro'));
      tr.nodes(nodes)
      tr.getLayer()?.batchDraw()
      setIdEnConflicto(null)
    }

    const raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  }, [selectedIds, shapes])

  const [isPanning, setIsPanning] = useState(false)
  const lastPanPosRef = useRef({ x: 0, y: 0 })

  const getPointerPos = (stage) => {
    const pointer = stage.getPointerPosition()
    const scale = stage.scaleX()
    return {
      x: (pointer.x - stage.x()) / scale,
      y: (pointer.y - stage.y()) / scale,
    }
  }

  const handleStageMouseDown = (e) => {
    // Paneo global si es middle, right, o espacio
    if (e.evt.button === 1 || e.evt.button === 2 || isSpaceDown) {
      setIsPanning(true)
      lastPanPosRef.current = { x: e.evt.clientX, y: e.evt.clientY }
      e.target.getStage().container().style.cursor = 'grabbing'
      return
    }

    if (activeTool === 'pan' && e.evt.button === 0) {
      setIsPanning(true)
      lastPanPosRef.current = { x: e.evt.clientX, y: e.evt.clientY }
      e.target.getStage().container().style.cursor = 'grabbing'
      return
    }

    const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'bg-rect'
    if (clickedOnEmpty) {
      setSelectedIds([])
      if (e.evt.button === 0) {
        selectionStartRef.current = getPointerPos(e.target.getStage())
        setSelectionRect({ ...selectionStartRef.current, width: 0, height: 0 })
      }
    }
  }

  const handleStageMouseMove = (e) => {
    if (isPanning) {
      const dx = e.evt.clientX - lastPanPosRef.current.x
      const dy = e.evt.clientY - lastPanPosRef.current.y
      setStagePos((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
      lastPanPosRef.current = { x: e.evt.clientX, y: e.evt.clientY }
      return
    }

    if (!selectionStartRef.current) return
    const pos = getPointerPos(e.target.getStage())
    setSelectionRect({
      x: Math.min(selectionStartRef.current.x, pos.x),
      y: Math.min(selectionStartRef.current.y, pos.y),
      width: Math.abs(pos.x - selectionStartRef.current.x),
      height: Math.abs(pos.y - selectionStartRef.current.y),
    })
  }

  const handleStageMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false)
      e.target.getStage().container().style.cursor = 'default'
    }

    if (selectionStartRef.current && selectionRect) {
      const box = selectionRect
      const selected = shapes.filter((shape) => {
        const sx = Number(shape.x) || 0
        const sy = Number(shape.y) || 0
        const sw = Number(shape.width) || 0
        const sh = Number(shape.height) || 0
        return (
          sx >= box.x && sy >= box.y &&
          sx + sw <= box.x + box.width &&
          sy + sh <= box.y + box.height
        )
      })
      setSelectedIds(selected.map((s) => s.id))
    }
    selectionStartRef.current = null
    setSelectionRect(null)
  }

  const handleWheel = (e) => {
    e.evt.preventDefault()
    const scaleBy = 1.1
    const stage = e.target.getStage()
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
    setStageScale(newScale)
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
  }

  const zoomToFit = useCallback(() => {
    if (!shapes.length) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    shapes.forEach(s => {
      const sx = Number(s.x) || 0; const sy = Number(s.y) || 0
      const sw = Number(s.width) || 0; const sh = Number(s.height) || 0
      if (sx < minX) minX = sx
      if (sy < minY) minY = sy
      if (sx + sw > maxX) maxX = sx + sw
      if (sy + sh > maxY) maxY = sy + sh
    })
    if (minX === Infinity) return
    const padding = 50
    const contentWidth = maxX - minX; const contentHeight = maxY - minY
    const scaleX = (size.width - padding * 2) / (contentWidth || 1)
    const scaleY = (size.height - padding * 2) / (contentHeight || 1)
    const scale = Math.min(scaleX, scaleY, 1.5)
    setStageScale(scale)
    setStagePos({
      x: size.width / 2 - (minX + contentWidth / 2) * scale,
      y: size.height / 2 - (minY + contentHeight / 2) * scale,
    })
  }, [shapes, size])

  const estiloPorTipo = (tipo) => {
    if (modoExport) {
      const fill = colorPorTipoParaExport(tipo)
      const opacity = tipo === 'ventana' ? 0.55 : 0.9
      return { fill, opacity }
    }

    // Tema claro profesional (plano arquitectónico real)
    if (!isDark) {
      if (tipo === 'muro') {
        return { fill: '#222222', opacity: 1 }  // Negro técnico
      }
      if (tipo === 'puerta') {
        return { fill: '#555555', opacity: 0.9 }   // Gris oscuro técnico
      }
      if (tipo === 'ventana') {
        return { fill: '#333333', opacity: 0.9 }   // Gris medio técnico
      }
      return { fill: '#333333', opacity: 0.85 }
    }

    // Tema oscuro - mejorado técnico
    if (tipo === 'muro') {
      return { fill: '#DDDDDD', opacity: 0.95 }  // Blanco técnico
    }
    if (tipo === 'puerta') {
      return { fill: '#94A3B8', opacity: 0.7 }
    }
    if (tipo === 'ventana') {
      return { fill: 'transparent', opacity: 1 }
    }

    return { fill: '#60A5FA', opacity: 0.9 }  // Azul suave técnico
  }

  // Color del stroke para muros (líneas)
  const strokeColor = isDark ? '#EEEEEE' : '#111111'
  const strokeWidthBase = isDark ? 1.2 : 1.5

  // Colores para exportaciones (tema claro)
  const colorPorTipoExportClaro = (tipo) => {
    if (tipo === 'muro') return '#1a1a1a'
    if (tipo === 'puerta') return '#8b5a2b'
    if (tipo === 'ventana') return '#333333'
    return '#333333'
  }

  return (
    <div ref={containerRef} className="relative h-full w-full bg-slate-50 dark:bg-[#0F172A]">
      {/* ── Info del plano (esquina superior) ── */}
      <div className="absolute top-3 left-3 z-10">
        <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">
          {exportTitulo || 'Plano sin título'}
        </div>
        <div className="text-[10px] text-slate-300 dark:text-slate-600 font-mono">
          1m = {Math.round(pxPorMetro)}px | m/px: {metrosPorPixel.toFixed(4)}
        </div>
      </div>

      {/* ── Widget de control (rotación + eliminar) para elemento seleccionado ── */}
      {selectedShape ? (
        <div className="absolute left-3 top-20 z-10 flex items-center gap-2">
          {/* Panel de Propiedades profesional */}
          {isTipoRect(selectedShape.tipo) && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 px-3 py-2 shadow-lg flex items-center gap-3 backdrop-blur">
              {/* Tipo badge */}
              <div className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider">
                {selectedShape.tipo}
              </div>

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>

              {/* Longitud */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">L:</span>
                <input
                  type="number"
                  step="0.05"
                  className="w-16 h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-xs font-mono focus:outline-none focus:border-blue-500"
                  value={aMetros(Math.max(Number(selectedShape.width) || 0, Number(selectedShape.height) || 0), metrosPorPixel).toFixed(2)}
                  onChange={(e) => {
                    const valM = parseFloat(e.target.value)
                    if (isNaN(valM) || valM <= 0) return
                    const valPx = valM * pxPorMetro
                    const isHoriz = (Number(selectedShape.width) || 0) >= (Number(selectedShape.height) || 0)
                    const patch = isHoriz ? { width: valPx } : { height: valPx }
                    actualizarForma(selectedShape.id, patch)
                  }}
                />
                <span className="text-[10px] text-slate-400">m</span>
              </div>

              {/* Grosor */}
              {tieneEspesorFijo(selectedShape.tipo) && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">e:</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-14 h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-xs font-mono focus:outline-none focus:border-blue-500"
                      value={aMetros(Math.min(Number(selectedShape.width) || 0, Number(selectedShape.height) || 0), metrosPorPixel).toFixed(2)}
                      onChange={(e) => {
                        const valM = parseFloat(e.target.value)
                        if (isNaN(valM) || valM <= 0) return
                        const valPx = valM * pxPorMetro
                        const isHoriz = (Number(selectedShape.width) || 0) >= (Number(selectedShape.height) || 0)
                        const patch = isHoriz ? { height: valPx } : { width: valPx }
                        actualizarForma(selectedShape.id, patch)
                      }}
                    />
                    <span className="text-[10px] text-slate-400">m</span>
                  </div>

                  {/* Rotación */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">α:</span>
                    <select
                      className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                      value={snapGrados(Number(selectedShape.rotation) || 0)}
                      onChange={(e) => aplicarRotacionSeleccion(e.target.value)}
                    >
                      {ROTACION_SNAPS.map((deg) => (
                        <option key={deg} value={deg}>{deg}°</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>

              {/* Botón eliminar */}
              <button
                onClick={eliminarSeleccionado}
                title="Eliminar"
                className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 hover:text-red-600 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 18h4.807a2.75 2.75 0 002.741-2.053l-.841-10.519.149.023A.75.75 0 0014.12 4.693V3.75A2.75 2.75 0 0011.25 1h1.5zm-.5 5.245c0-.27.022-.537.063-.8l.841 10.519a.25.25 0 01-.232.188H7.596a.25.25 0 01-.232-.188l.841-10.519c.041-.263.063-.53.063-.8z" clipRule="evenodd" />
                </svg>
              </button>
</div>
          )}
        </div>
      ) : null}

      {/* ── Editor de texto inline (HTML flotante sobre el Stage) ── */}
      {editingId ? (
        <div
          className="fixed z-50 shadow-2xl"
          style={{
            left: editingPos.x,
            top: editingPos.y,
            width: editingPos.width,
          }}
        >
          <textarea
            ref={textareaRef}
            value={editingText}
            rows={2}
            className="
              w-full resize-none rounded-lg border-2 px-3 py-2
              text-sm font-semibold leading-snug outline-none
              bg-slate-900 border-sky-400 text-sky-200
              placeholder-slate-500 shadow-lg
            "
            placeholder="Escribe aquí…"
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                cerrarEditorTexto(true)
              }
              if (e.key === 'Escape') {
                cerrarEditorTexto(false)
              }
            }}
            onBlur={() => cerrarEditorTexto(true)}
          />
          <div className="mt-1 text-[10px] text-slate-500 text-center">
            Enter para guardar · Esc para cancelar
          </div>
        </div>
      ) : null}

      {/* ── Toolbar de Herramientas (Select / Pan) ── */}
      <div className="absolute bottom-6 left-8 z-50 flex flex-col items-center gap-2 p-1.5 rounded-2xl bg-slate-900/95 border border-slate-700 backdrop-blur-md shadow-2xl">
        <button
          onClick={() => setActiveTool('select')}
          className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all ${
            activeTool === 'select' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Seleccionar (V)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>
        </button>
        <button
          onClick={() => setActiveTool('pan')}
          className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all ${
            activeTool === 'pan' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Mover Lienzo (H)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V3a2 2 0 0 0-4 0v9"/><path d="M6 12v-1a2 2 0 0 0-4 0v5a8 8 0 0 0 8 8h2a8 8 0 0 0 7-7.3l.5-4.7a3 3 0 0 0-3-3H14"/></svg>
        </button>
        <div className="w-5 h-px bg-slate-700 my-0.5"></div>
        <button
          onClick={zoomToFit}
          className="flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          title="Centrar Todo"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h4v2H6v2H4zm16 0h-4v2h2v2h2zM4 20h4v-2H6v-2H4zm16 0h-4v-2h2v-2h2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>

      <Stage 
        ref={stageRef} 
        width={size.width} 
        height={size.height} 
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onWheel={handleWheel}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={isSpaceDown || undefined}
      >
        <Layer>

          <Rect
            name="bg-rect"
            x={-stagePos.x / stageScale}
            y={-stagePos.y / stageScale}
            width={size.width / stageScale}
            height={size.height / stageScale}
            fill={modoExport ? '#FFFFFF' : isDark ? '#0f172a' : '#fafafa'}
          />

          {modoExport
            ? null
            : grid.map((l, idx) => (
              <Line
                key={idx}
                points={l.points}
                stroke={l.major ? gridColorMajor : gridColor}
                strokeWidth={l.major ? 0.8 : 0.4}
                opacity={l.major ? 0.5 : 0.3}
              />
            ))}

          {modoExport ? null : (
            <Text
              x={12}
              y={10}
              text="Editor CAD (demo)"
              fill={isDark ? '#38BDF8' : '#1E293B'}
              fontSize={12}
              opacity={0.75}
            />
          )}
        </Layer>

        <Layer>
          {/* ── Elementos tipo RECT (muro / puerta / ventana) ── */}
          {shapes.filter((s) => isTipoRect(s.tipo)).map((s) => (
            <Rect
              key={s.id}
              id={s.id}
              ref={(node) => {
                if (!node) return
                shapeRefs.current[s.id] = node
              }}
              x={Number(s.x) || 0}
              y={Number(s.y) || 0}
              width={Number(s.width) || 0}
              height={Number(s.height) || 0}
              rotation={Number(s.rotation) || 0}
              {...(idEnConflicto === s.id && s.tipo === 'muro'
                ? { fill: '#EF4444', opacity: 0.85 }
                : estiloPorTipo(s.tipo))}
              stroke={selectedIds.includes(s.id) ? (isDark ? '#38BDF8' : '#0F172A') : undefined}
              strokeWidth={selectedIds.includes(s.id) ? 1.5 : 0}
              cornerRadius={2}
              draggable={activeTool === 'select'}
              onClick={(e) => {
                if (activeTool !== 'select') return;
                if (e.evt.shiftKey) {
                  setSelectedIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])
                } else {
                  setSelectedIds([s.id])
                }
              }}
              onTap={() => { if (activeTool === 'select') setSelectedIds([s.id]) }}
              onDragStart={() => {
                if (activeTool !== 'select') return;
                if (!selectedIds.includes(s.id)) {
                  setSelectedIds([s.id])
                }
              }}
              onDragMove={(e) => {
                handleMultiDragMove(e, s.id)
                if (s.tipo !== 'muro') return
                const nx = e.target.x(), ny = e.target.y()
                // Snap magnético
                const snap = calcularSnap(shapes, s.id, nx, ny)
                if (snap) {
                  e.target.position(snap)
                  setSnapPos(snap)
                } else {
                  setSnapPos(null)
                }
                // Conflicto con umbral 4px — ya no dispara en esquinas
                const rect = {
                  x: (snap?.x ?? nx),
                  y: (snap?.y ?? ny),
                  width: Number(s.width) || 0,
                  height: Number(s.height) || 0,
                }
                setIdEnConflicto(muroTieneConflicto(s.id, rect) ? s.id : null)
              }}
              onDragEnd={(e) => {
                setIdEnConflicto(null)
                setSnapPos(null)
                handleMultiDragEnd(e, s.id)
              }}
              onTransform={(e) => {
                const node = e.target
                const snappedRotation = snapGrados(node.rotation())
                if (node.rotation() !== snappedRotation) {
                  node.rotation(snappedRotation)
                }
                if (tieneEspesorFijo(s.tipo)) {
                  const isLocalHorizontal = (Number(s.width) || 0) >= (Number(s.height) || 0)
                  if (isLocalHorizontal) {
                    node.scaleY(1) // El espesor está en Y, mantener escala 1
                  } else {
                    node.scaleX(1) // El espesor está en X, mantener escala 1
                  }
                }
                node.getLayer()?.batchDraw()
                if (s.tipo !== 'muro') return
                const rect = clientRectDeNode(node)
                setIdEnConflicto(muroTieneConflicto(s.id, rect) ? s.id : null)
              }}
              onTransformEnd={(e) => {
                const node = e.target
                const scaleX = node.scaleX()
                const scaleY = node.scaleY()
                const rotation = snapGrados(node.rotation())
                node.scaleX(1)
                node.scaleY(1)
                const patch = { x: node.x(), y: node.y(), rotation }
                
                if (tieneEspesorFijo(s.tipo)) {
                  const esp = espesorPxPorTipo(s.tipo, pxPorMetro)
                  const isLocalHorizontal = (Number(s.width) || 0) >= (Number(s.height) || 0)
                  
                  if (isLocalHorizontal) {
                    patch.width = Math.max(6, node.width() * scaleX)
                    patch.height = esp
                    node.width(patch.width)
                    node.height(esp)
                  } else {
                    patch.width = esp
                    patch.height = Math.max(6, node.height() * scaleY)
                    node.width(esp)
                    node.height(patch.height)
                  }
                } else {
                  patch.width = Math.max(6, node.width() * scaleX)
                  patch.height = Math.max(6, node.height() * scaleY)
                  node.width(patch.width)
                  node.height(patch.height)
                }
                
                setIdEnConflicto(null)
                const ok = actualizarForma(s.id, patch)
                if (!ok) {
                  node.position({ x: Number(s.x) || 0, y: Number(s.y) || 0 })
                  node.width(Number(s.width) || 0)
                  node.height(Number(s.height) || 0)
                  node.rotation(Number(s.rotation) || 0)
                  node.getLayer()?.batchDraw()
                }
              }}
            />
          ))}

          {/* ── Etiquetas numeradas para muros ── */}
          {modoExport
            ? null
            : shapes.filter((s) => s.tipo === 'muro').map((s) => {
              const num = muroIndexById.get(s.id)
              if (!num) return null
              const w = Number(s.width) || 0
              const h = Number(s.height) || 0
              const cx = (Number(s.x) || 0) + w / 2
              const cy = (Number(s.y) || 0) + h / 2
              const label = `M${num}`
              const bg = isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)'
              const border = isDark ? '#38BDF8' : '#0F172A'
              const textCol = isDark ? '#E2E8F0' : '#0F172A'

              return (
                <Group key={`muro-label-${s.id}`} x={cx} y={cy} listening={false}>
                  <Rect
                    x={-14}
                    y={-10}
                    width={28}
                    height={20}
                    fill={bg}
                    stroke={border}
                    strokeWidth={1}
                    cornerRadius={6}
                  />
                  <Text
                    x={-14}
                    y={-6}
                    width={28}
                    text={label}
                    fontSize={11}
                    align="center"
                    fill={textCol}
                    fontFamily="ui-monospace, SFMono-Regular, monospace"
                    fontStyle="bold"
                  />
                </Group>
              )
            })}

          {/* ── Overlay símbolo arquitectónico de PUERTA ── */}
          {shapes.filter((s) => s.tipo === 'puerta').map((s) => {
            const w = Number(s.width) || 0
            const h = Number(s.height) || 0
            const rot = Number(s.rotation) || 0
            // Gris neutro para la puerta — funciona en dark y light
            const doorColor = isDark ? '#CBD5E1' : '#475569'   // slate-300 / slate-600
            const doorFill = isDark ? 'rgba(203,213,225,0.10)' : 'rgba(71,85,105,0.08)'
            return (
              <Group
                key={`door-sym-${s.id}`}
                x={Number(s.x) || 0}
                y={Number(s.y) || 0}
                rotation={rot}
                listening={false}   // no captura eventos — el Rect subyacente los maneja
              >
                {/* Línea de umbral (el vano) */}
                <Line
                  points={[0, h / 2, w, h / 2]}
                  stroke={doorColor}
                  strokeWidth={h}
                  opacity={0.18}
                />
                {/* Hinge dot */}
                <Circle x={0} y={h / 2} radius={3.5} fill={doorColor} />
                {/* Panel de la puerta (posición abierta — perpendicular) */}
                <Line
                  points={[0, h / 2, 0, h / 2 - w]}
                  stroke={doorColor}
                  strokeWidth={2.5}
                  lineCap="round"
                />
                {/* Arco de apertura */}
                <Arc
                  x={0}
                  y={h / 2}
                  innerRadius={w - 2}
                  outerRadius={w}
                  angle={90}
                  rotation={-90}
                  fill={doorFill}
                  stroke={doorColor}
                  strokeWidth={1}
                />
              </Group>
            )
          })}

          {/* ── Overlay símbolo arquitectónico de VENTANA (4 paneles, sin fondo) ── */}
          {shapes.filter((s) => s.tipo === 'ventana').map((s) => {
            const w = Number(s.width) || 0
            const h = Number(s.height) || 0
            const rot = Number(s.rotation) || 0
            // Color de la ventana: funciona en ambos temas
            const winColor = isDark ? '#7DD3FC' : '#0369A1'   // sky-300 / sky-700
            return (
              <Group
                key={`win-sym-${s.id}`}
                x={Number(s.x) || 0}
                y={Number(s.y) || 0}
                rotation={rot}
                listening={false}
              >
                {/* Marco exterior */}
                <Rect
                  x={0} y={0} width={w} height={h}
                  fill="transparent"
                  stroke={winColor}
                  strokeWidth={2}
                  cornerRadius={1}
                />
                {/* Línea paralela interior superior (hueco de vidrio) */}
                <Line
                  points={[0, h * 0.25, w, h * 0.25]}
                  stroke={winColor}
                  strokeWidth={1}
                />
                {/* Línea paralela interior inferior */}
                <Line
                  points={[0, h * 0.75, w, h * 0.75]}
                  stroke={winColor}
                  strokeWidth={1}
                />
                {/* Cruceta vertical — divide en 2 hojas */}
                <Line
                  points={[w / 2, 0, w / 2, h]}
                  stroke={winColor}
                  strokeWidth={1.5}
                />
              </Group>
            )
          })}

          {/* ── Etiquetas de medida para elementos rect ── */}
          {shapes.filter((s) => s.tipo === 'muro' || s.tipo === 'puerta').map((s) => {
            const isSelected = selectedIds.includes(s.id)
            const w = Number(s.width) || 0
            const h = Number(s.height) || 0
            const rot = Number(s.rotation) || 0

            const lengthPx = Math.max(w, h)
            const isLocalVertical = h > w
            const m = aMetros(lengthPx, metrosPorPixel)
            const label = `${m.toFixed(2)}m`

            // Rotación del texto: alineado al lado largo
            let textRotAbs = rot
            if (isLocalVertical) textRotAbs += 90
            while (textRotAbs > 90) textRotAbs -= 180
            while (textRotAbs <= -90) textRotAbs += 180
            const textRotRel = textRotAbs - rot

            // Offset perpendicular (local) para que no tape el elemento
            const off = 14
            const xOff = isLocalVertical ? -(w / 2 + off) : 0
            const yOff = isLocalVertical ? 0 : -(h / 2 + off)

            const bgFill = modoExport
              ? 'rgba(255,255,255,0.96)'
              : (isDark ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.88)')
            const border = modoExport
              ? '#0F172A'
              : (isSelected ? (isDark ? '#38BDF8' : '#0F172A') : (isDark ? 'rgba(56,189,248,0.35)' : 'rgba(15,23,42,0.25)'))
            const textFill = modoExport
              ? '#0F172A'
              : (isSelected ? (isDark ? '#38BDF8' : '#0369A1') : (isDark ? '#93C5FD' : '#1E293B'))

            return (
              <Group
                key={`${s.id}-measure`}
                x={Number(s.x) || 0}
                y={Number(s.y) || 0}
                rotation={rot}
                listening={false}
              >
                <Group x={w / 2 + xOff} y={h / 2 + yOff} rotation={textRotRel}>
                  <Rect
                    x={-24}
                    y={-10}
                    width={48}
                    height={20}
                    fill={bgFill}
                    stroke={border}
                    strokeWidth={1}
                    cornerRadius={6}
                    shadowColor={modoExport ? 'transparent' : 'black'}
                    shadowBlur={modoExport ? 0 : 4}
                    shadowOpacity={modoExport ? 0 : 0.12}
                    shadowOffsetY={modoExport ? 0 : 1}
                    opacity={isSelected || modoExport ? 1 : 0.75}
                  />
                  <Text
                    x={-24}
                    y={-5.5}
                    width={48}
                    text={label}
                    fontSize={11}
                    fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                    fontStyle="bold"
                    align="center"
                    fill={textFill}
                    opacity={isSelected || modoExport ? 1 : 0.85}
                  />
                </Group>
              </Group>
            )
          })}

          {/* ── TEXTO libre ── */}
          {shapes.filter((s) => s.tipo === 'texto').map((s) => {
            const isSelected = selectedIds.includes(s.id)
            const isEditing = editingId === s.id
            const textColor = isDark ? '#A5F3FC' : '#1D4ED8'   // cyan-200 / blue-700
            const bgColor = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(29,78,216,0.07)'
            const borderCol = isSelected
              ? (isDark ? '#38BDF8' : '#2563EB')
              : (isDark ? 'rgba(56,189,248,0.25)' : 'rgba(37,99,235,0.20)')

            const txt = String(s.texto || '')
            const fs = Number(s.tamano_fuente) || 16
            const px = Number(s.x) || 0
            const py = Number(s.y) || 0
            // Estimar ancho del texto para el fondo
            const approxW = Math.max(60, txt.length * fs * 0.6 + 16)
            const approxH = fs + 14

            return (
              <Group
                key={s.id}
                ref={(node) => { if (node) shapeRefs.current[s.id] = node }}
                x={px}
                y={py}
                draggable={!isEditing && activeTool === 'select'}
                onClick={(e) => {
                  if (activeTool !== 'select') return;
                  if (e.evt.shiftKey) setSelectedIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])
                  else setSelectedIds([s.id])
                }}
                onTap={() => { if (activeTool === 'select') setSelectedIds([s.id]) }}
                onDblClick={(e) => {
                  if (activeTool !== 'select') return;
                  setSelectedIds([s.id])
                  abrirEditorTexto(s, e.target)
                }}
                onDragStart={(e) => {
                  if (!selectedIds.includes(s.id)) setSelectedIds([s.id])
                }}
                onDragMove={(e) => handleMultiDragMove(e, s.id)}
                onDragEnd={(e) => handleMultiDragEnd(e, s.id)}
              >
                {/* Fondo pastilla */}
                <Rect
                  x={-8}
                  y={-6}
                  width={approxW}
                  height={approxH}
                  fill={bgColor}
                  stroke={borderCol}
                  strokeWidth={isSelected ? 1.5 : 1}
                  cornerRadius={5}
                />
                {/* Indicador izq */}
                <Rect
                  x={-8}
                  y={-6}
                  width={3}
                  height={approxH}
                  fill={isDark ? '#38BDF8' : '#2563EB'}
                  cornerRadius={[5, 0, 0, 5]}
                />
                {/* Texto */}
                <Text
                  x={0}
                  y={0}
                  text={isEditing ? '' : txt}
                  fontSize={fs}
                  fill={textColor}
                  fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
                  fontStyle="600"
                  listening={false}
                />
              </Group>
            )
          })}

          {/* ── COTAS arquitectónicas ── */}
          {shapes.filter((s) => s.tipo === 'cota').map((s) => {
            const x1 = Number(s.x1) || 0
            const y1 = Number(s.y1) || 0
            const x2 = Number(s.x2) || 0
            const y2 = Number(s.y2) || 0
            const cx = (x1 + x2) / 2
            const cy = (y1 + y2) / 2
            const { a: tickA, b: tickB } = cotaTicks({ x1, y1, x2, y2, tick: 10 })
            const isSelected = selectedIds.includes(s.id)
            const isEditing = editingId === s.id

            // Paleta de cota: naranja cálido
            const cotaLine = isDark ? '#FB923C' : '#EA580C'    // orange-400 / orange-600
            const cotaBadge = isDark ? '#431407' : '#FFF7ED'    // fondo badge
            const cotaText = isDark ? '#FDBA74' : '#9A3412'    // orange-300 / orange-800

            const valorStr = String(s.valor || '')
            const badgeW = Math.max(44, valorStr.length * 7.5 + 14)

            return (
              <Group key={s.id}>
                {/* ── Grupo principal arrastrable (línea + ticks + label) ── */}
                <Group
                  ref={(node) => { if (node) shapeRefs.current[s.id] = node }}
                  draggable={activeTool === 'select'}
                  onClick={(e) => {
                    if (activeTool !== 'select') return;
                    if (e.evt.shiftKey) setSelectedIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])
                    else setSelectedIds([s.id])
                  }}
                  onTap={() => { if (activeTool === 'select') setSelectedIds([s.id]) }}
                  onDragStart={(e) => {
                    if (!selectedIds.includes(s.id)) setSelectedIds([s.id])
                  }}
                  onDragMove={(e) => handleMultiDragMove(e, s.id)}
                  onDragEnd={(e) => handleMultiDragEnd(e, s.id)}
                >
                  {/* Línea principal */}
                  <Line
                    points={[x1, y1, x2, y2]}
                    stroke={cotaLine}
                    strokeWidth={isSelected ? 2.5 : 1.8}
                    lineCap="round"
                  />
                  {/* Ticks extremos */}
                  <Line points={tickA} stroke={cotaLine} strokeWidth={2} lineCap="round" />
                  <Line points={tickB} stroke={cotaLine} strokeWidth={2} lineCap="round" />

                  {/* Badge del valor — doble-click para editar */}
                  <Group
                    x={cx - badgeW / 2}
                    y={cy - 14}
                    onDblClick={(e) => {
                      setSelectedIds([s.id])
                      abrirEditorTexto(s, e.target)
                    }}
                  >
                    <Rect
                      width={badgeW}
                      height={20}
                      fill={cotaBadge}
                      stroke={cotaLine}
                      strokeWidth={1}
                      cornerRadius={4}
                    />
                    <Text
                      x={4}
                      y={4}
                      text={isEditing ? '...' : valorStr}
                      fontSize={11}
                      fill={cotaText}
                      fontFamily="ui-monospace, SFMono-Regular, monospace"
                      fontStyle="bold"
                      width={badgeW - 8}
                      align="center"
                    />
                  </Group>
                </Group>

                {/* ── Handles de resize (solo cuando está seleccionada) ── */}
                {isSelected && (
                  <>
                    {/* Handle extremo A */}
                    <Circle
                      x={x1} y={y1} radius={8}
                      fill={isDark ? '#1E293B' : '#FFFFFF'}
                      stroke={cotaLine}
                      strokeWidth={2.5}
                      draggable
                      onMouseEnter={(e) => { e.target.getStage().container().style.cursor = 'crosshair' }}
                      onMouseLeave={(e) => { e.target.getStage().container().style.cursor = 'default' }}
                      onDragEnd={(e) => {
                        const newX1 = e.target.x()
                        const newY1 = e.target.y()
                        // Recalcular el valor en metros automáticamente
                        const nuevoValor = calcularValorCota(newX1, newY1, x2, y2, metrosPorPixel)
                        actualizarForma(s.id, { x1: newX1, y1: newY1, valor: nuevoValor })
                        e.target.position({ x: newX1, y: newY1 })
                      }}
                    />
                    {/* Handle extremo B */}
                    <Circle
                      x={x2} y={y2} radius={8}
                      fill={isDark ? '#1E293B' : '#FFFFFF'}
                      stroke={cotaLine}
                      strokeWidth={2.5}
                      draggable
                      onMouseEnter={(e) => { e.target.getStage().container().style.cursor = 'crosshair' }}
                      onMouseLeave={(e) => { e.target.getStage().container().style.cursor = 'default' }}
                      onDragEnd={(e) => {
                        const newX2 = e.target.x()
                        const newY2 = e.target.y()
                        // Recalcular el valor en metros automáticamente
                        const nuevoValor = calcularValorCota(x1, y1, newX2, newY2, metrosPorPixel)
                        actualizarForma(s.id, { x2: newX2, y2: newY2, valor: nuevoValor })
                        e.target.position({ x: newX2, y: newY2 })
                      }}
                    />
                  </>
                )}
              </Group>
            )
          })}

          {/* ── SÍMBOLOS (paths SVG con color por categoría) ── */}
          {shapes.filter((s) => s.tipo === 'simbolo').map((s) => {
            const svgPath = symbolPathByName(s.nombre)
            const escala = Number(s.escala) || 1
            const rot = Number(s.rotacion) || 0
            if (!svgPath) return null

            const isSelected = selectedIds.includes(s.id)
            const { stroke: symStroke } = symbolColors(s.nombre, isDark)
            const selBorder = isDark ? '#38BDF8' : '#0F172A'
            const stroke = isSelected ? selBorder : (modoExport ? '#0F172A' : symStroke)
            const strokeWidth = modoExport ? 1.2 : 1.6

            return (
              <Group
                key={s.id}
                ref={(node) => { if (node) shapeRefs.current[s.id] = node }}
                x={Number(s.x) || 0}
                y={Number(s.y) || 0}
                rotation={rot}
                scaleX={escala}
                scaleY={escala}
                draggable={activeTool === 'select'}
                onClick={(e) => {
                  if (activeTool !== 'select') return;
                  if (e.evt.shiftKey) setSelectedIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])
                  else setSelectedIds([s.id])
                }}
                onTap={() => { if (activeTool === 'select') setSelectedIds([s.id]) }}
                onDragStart={(e) => {
                  if (!selectedIds.includes(s.id)) setSelectedIds([s.id])
                }}
                onDragMove={(e) => handleMultiDragMove(e, s.id)}
                onDragEnd={(e) => handleMultiDragEnd(e, s.id)}
              >
                {/* Path del símbolo (estilo plano técnico) */}
                <Path
                  data={svgPath}
                  fill={'transparent'}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </Group>
            )
          })}

          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            keepRatio={false}
            rotationSnaps={ROTACION_SNAPS}
            rotationSnapTolerance={360}
            enabledAnchors={
              selectedShape?.tipo && tieneEspesorFijo(selectedShape.tipo)
                ? (Number(selectedShape.width) || 0) >= (Number(selectedShape.height) || 0)
                  ? ['middle-left', 'middle-right']
                  : ['top-center', 'bottom-center']
                : ['top-left', 'top-right', 'bottom-left', 'bottom-right']
            }
            borderStroke={isDark ? '#38BDF8' : '#0F172A'}
            anchorStroke={isDark ? '#38BDF8' : '#0F172A'}
            anchorFill={isDark ? '#0F172A' : '#FFFFFF'}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 6 || newBox.height < 6) return oldBox
              return newBox
            }}
          />

          {selectionRect && !modoExport && (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(56, 189, 248, 0.2)"
              stroke="#38BDF8"
              strokeWidth={1}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  )
})
