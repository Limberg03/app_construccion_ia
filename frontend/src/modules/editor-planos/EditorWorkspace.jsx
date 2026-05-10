import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

import { CanvasBoard } from './CanvasBoard'
import { EditorToolbar } from './EditorToolbar'
import { ElementsPalette } from './ElementsPalette'
import { PlanoChatbotPanel } from './PlanoChatbotPanel'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { usePlanoChatbot } from '../../hooks/usePlanoChatbot'

export const EditorWorkspace = forwardRef(function EditorWorkspace(
  {
    datosVectoriales,
    planoId,
    onChange,
    onBack,
    onClear,
    onSave,
    onAddElemento,   // fn(tipo)              — rect simples
    onAddTexto,      // fn(x, y, texto)
    onAddCota,       // fn(x1,y1,x2,y2,valor)
    onAddSimbolo,    // fn(x, y, nombre)
    exportTitulo,
    exportSubtitulo,
    exportUbicacion,
    exportDescripcion,
    saving,
    isDark,
    onToggleTheme,
    iaPreviews,      // Previews generados por IA
    showPreviews,    // Si el panel de previews esta visible
    onTogglePreviews, // Toggle del panel de previews
    escalaMetrosPorPixel,
  },
  ref,
) {
  const canvasRef     = useRef(null)
  const canvasDivRef  = useRef(null)   // div contenedor del Stage (para getBoundingClientRect)
  
  const [canUndoState, setCanUndoState] = useState(false)
  const [canRedoState, setCanRedoState] = useState(false)
  const [zoomLevelState, setZoomLevelState] = useState('100%')
  const [showChat, setShowChat] = useState(false)

  // Punto 3: Modal de configuración previa
  const [pendingDrop, setPendingDrop] = useState(null)
  const [formDims, setFormDims] = useState({ largo: 1, grosor: 0.15, rotacion: 0 })

  const {
    history,
    isComposing,
    error,
    processMessage,
  } = usePlanoChatbot({ planoId, canvasRef })

  useImperativeHandle(
    ref,
    () => ({
      exportarJpg: () => canvasRef.current?.exportarJpg?.(),
      exportarPdf: () => canvasRef.current?.exportarPdf?.(),
      getCanvasBoard: () => canvasRef.current,
    }),
    [],
  )

  // ── Drag-and-drop desde el pallete al canvas ─────────────────────────────
  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e) => {
    e.preventDefault()

    const raw = e.dataTransfer.getData('application/x-plano-element')
    if (!raw) return

    let parsed
    try { parsed = JSON.parse(raw) } catch { return }

    // Calcular coordenadas relativas dentro del canvas
    const rect = canvasDivRef.current?.getBoundingClientRect()
    const x = rect ? e.clientX - rect.left : 100
    const y = rect ? e.clientY - rect.top  : 100

    const { tipo, payload = {} } = parsed

    const metrosPorPixel = Number(escalaMetrosPorPixel)
    const pxPorMetro = metrosPorPixel > 0 ? (1 / metrosPorPixel) : 100

    if (tipo === 'muro' || tipo === 'puerta' || tipo === 'ventana') {
      const espesores = { muro: 0.2, puerta: 0.15, ventana: 0.1 }
      const largos    = { muro: 1,   puerta: 0.9,  ventana: 1.2 }
      
      setFormDims({ 
        largo: largos[tipo] || 1, 
        grosor: espesores[tipo] || 0.15,
        rotacion: 0
      })
      setPendingDrop({ tipo, payload, x, y })
      return
    }

    if (tipo === 'texto') {
      onAddTexto?.(x, y, payload.texto ?? 'Texto', payload.tamano_fuente ?? 16)
      return
    }

    if (tipo === 'cota') {
      // Cota horizontal de 200px centrada en el punto de drop
      const off = 100
      const newX1 = x - off
      const newX2 = x + off
      const newY1 = y
      const newY2 = y
      // Calcular valor real en metros desde la distancia en px
      const distPx = Math.hypot(newX2 - newX1, newY2 - newY1)
      const metros = distPx * (metrosPorPixel > 0 ? metrosPorPixel : 0.01)
      const valorCalculado = `${metros.toFixed(2)} m`
      onAddCota?.(newX1, newY1, newX2, newY2, valorCalculado, payload.orientacion ?? 'horizontal')
      return
    }

    if (tipo === 'simbolo') {
      onAddSimbolo?.(x - 50, y - 30, payload.nombre ?? 'cama', payload.categoria ?? 'mueble', payload.rotacion ?? 0, payload.escala ?? 1)
      return
    }
  }

  const handleConfirmDrop = () => {
    if (!pendingDrop) return
    const { tipo, payload, x, y } = pendingDrop
    const metrosPorPixel = Number(escalaMetrosPorPixel)
    const pxPorMetro = metrosPorPixel > 0 ? (1 / metrosPorPixel) : 100

    const largoPx = Number(formDims.largo) * pxPorMetro
    const espesorPx = Number(formDims.grosor) * pxPorMetro

    const nuevo = {
      id: Date.now(),
      tipo,
      x: x - largoPx / 2,
      y: y - espesorPx / 2,
      width:  largoPx,
      height: espesorPx,
      rotation: Number(formDims.rotacion),
      ...payload,
    }
    onChange?.([...(Array.isArray(datosVectoriales) ? datosVectoriales : []), nuevo])
    setPendingDrop(null)
  }

  return (
    <div className="relative w-full h-full">
      {/* Modal del Punto 3: Configuracion previa */}
      {pendingDrop && (
        <Modal
          open={true}
          onClose={() => setPendingDrop(null)}
          title={`Configurar ${pendingDrop.tipo}`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Largo (metros)
              </label>
              <input
                type="number"
                step="0.05"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                value={formDims.largo}
                onChange={e => setFormDims(prev => ({ ...prev, largo: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Grosor (metros)
              </label>
              <input
                type="number"
                step="0.05"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                value={formDims.grosor}
                onChange={e => setFormDims(prev => ({ ...prev, grosor: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Orientación
              </label>
              <select
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                value={formDims.rotacion}
                onChange={e => setFormDims(prev => ({ ...prev, rotacion: e.target.value }))}
              >
                <option value="0">Horizontal (0°)</option>
                <option value="90">Vertical (90°)</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setPendingDrop(null)}>Cancelar</Button>
              <Button variant="primary" onClick={handleConfirmDrop}>Insertar</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Panel de previews de IA (lado izquierdo) ─── */}
      {iaPreviews && (
        <div className={[
          'absolute left-0 top-0 bottom-0 z-30 transition-all duration-300',
          showPreviews ? 'w-80' : 'w-12',
        ].join(' ')}>
          {/* Toggle button */}
          <button
            type="button"
            onClick={onTogglePreviews}
            className={[
              'absolute top-4 h-10 w-10 rounded-r-lg flex items-center justify-center',
              'bg-slate-800 border border-l-0 border-slate-600',
              'text-white hover:bg-slate-700 transition-colors',
              showPreviews ? 'left-80 -translate-x-full' : 'left-0',
            ].join(' ')}
            title={showPreviews ? 'Ocultar previews' : 'Ver previews IA'}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={showPreviews ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
            </svg>
          </button>

          {/* Contenido del panel */}
          <div className={[
            'h-full bg-slate-950/95 border-r border-slate-700 overflow-y-auto',
            showPreviews ? 'block' : 'hidden',
          ].join(' ')}>
            <div className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-white">Previews IA</h3>

              {iaPreviews.plano_2d && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Plano 2D</p>
                  <img
                    src={iaPreviews.plano_2d}
                    alt="Plano 2D"
                    className="w-full rounded-lg border border-slate-700"
                  />
                </div>
              )}

              {iaPreviews.exterior_1 && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Vista frente</p>
                  <img
                    src={iaPreviews.exterior_1}
                    alt="Vista frente"
                    className="w-full rounded-lg border border-slate-700"
                  />
                </div>
              )}

              {iaPreviews.exterior_2 && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Vista lateral</p>
                  <img
                    src={iaPreviews.exterior_2}
                    alt="Vista lateral"
                    className="w-full rounded-lg border border-slate-700"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Canvas principal ──────────────────────────────────────────── */}
      <div
        ref={canvasDivRef}
        className={[
          'absolute inset-0 transition-all duration-300',
          iaPreviews && showPreviews ? 'left-80' : 'left-0',
        ].join(' ')}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
<CanvasBoard
            ref={canvasRef}
            datosVectoriales={datosVectoriales}
            onChange={onChange}
            isDark={isDark}
            escalaMetrosPorPixel={escalaMetrosPorPixel}
            exportTitulo={exportTitulo}
            exportSubtitulo={exportSubtitulo}
            exportUbicacion={exportUbicacion}
            exportDescripcion={exportDescripcion}
            onUndoChange={(can) => setCanUndoState(can)}
            onRedoChange={(can) => setCanRedoState(can)}
            onZoomChange={(z) => setZoomLevelState(z)}
          />
      </div>

      {/* ── Panel de elementos — lado derecho ────────────────────────── */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
        <ElementsPalette isDark={isDark} />
      </div>

      {/* ── Boton de chatbot ─────────────────────────────────────────── */}
      <div className="absolute right-4 bottom-24 z-30 pointer-events-auto">
        <Button variant="secondary" size="sm" onClick={() => setShowChat(true)}>
          Chat IA
        </Button>
      </div>

      {showChat ? (
        <div className="absolute right-4 bottom-40 z-40 pointer-events-auto">
          <PlanoChatbotPanel
            history={history}
            isComposing={isComposing}
            error={error}
            onSend={processMessage}
            onClose={() => setShowChat(false)}
          />
        </div>
      ) : null}

      {/* ── Toolbar inferior ─────────────────────────────────────────── */}
      <div className="absolute left-0 right-0 bottom-0 z-20 pointer-events-none">
        <div className="pointer-events-auto">
          <EditorToolbar
            onBack={onBack}
            onClear={onClear}
            onSave={onSave}
            onExportJpg={() => canvasRef.current?.exportarJpg?.()}
            onExportPdf={() => canvasRef.current?.exportarPdf?.()}
            onZoomIn={() => canvasRef.current?.zoomIn?.()}
            onZoomOut={() => canvasRef.current?.zoomOut?.()}
            onZoomFit={() => canvasRef.current?.zoomToFit?.()}
            onUndo={() => canvasRef.current?.undo?.()}
            onRedo={() => canvasRef.current?.redo?.()}
            saving={saving}
            isDark={isDark}
            onToggleTheme={onToggleTheme}
            canUndo={canUndoState}
            canRedo={canRedoState}
            zoomLevel={zoomLevelState}
          />
        </div>
      </div>
    </div>
  )
})
