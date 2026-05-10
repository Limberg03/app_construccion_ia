/**
 * EditorCAD - Componente principal del editor
 * Integra toolbar, canvas y sidebar
 */
import { useEffect } from 'react'
import { useEditorStore } from './store/editorStore'
import { EditorCanvas } from './components/EditorCanvas'
import { EditorToolbar } from './components/EditorToolbar'
import { EditorSidebar } from './components/EditorSidebar'
import './styles/editor-theme.css'

export function EditorCAD() {
  const theme = useEditorStore((s) => s.theme)
  const planoInfo = useEditorStore((s) => s.planoInfo)
  const elementos = useEditorStore((s) => s.elementos)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const zoom = useEditorStore((s) => s.zoom)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)
  const snapToGrid = useEditorStore((s) => s.snapToGrid)
  const gridSize = useEditorStore((s) => s.gridSize)

  // Aplicar tema al documento
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const calcularAreaTotal = () => {
    if (elementos.length === 0) return '0.00 m²'
    const muros = elementos.filter((el) => el.tipo === 'muro')
    if (muros.length === 0) return '0.00 m²'
    const minX = Math.min(...muros.map((m) => m.x))
    const minY = Math.min(...muros.map((m) => m.y))
    const maxX = Math.max(...muros.map((m) => m.x + m.width))
    const maxY = Math.max(...muros.map((m) => m.y + m.height))
    const anchoM = ((maxX - minX) / 100).toFixed(2)
    const altoM = ((maxY - minY) / 100).toFixed(2)
    return `${anchoM} x ${altoM} m`
  }

  return (
    <div className="editor-canvas">
      {/* Toolbar superior */}
      <EditorToolbar />

      {/* Area de trabajo */}
      <div className="editor-workspace">
        {/* Canvas principal */}
        <EditorCanvas />

        {/* Panel lateral */}
        <EditorSidebar />
      </div>

      {/* Barra de estado */}
      <StatusBar
        elementos={elementos}
        selectedIds={selectedIds}
        zoom={zoom}
        panX={panX}
        panY={panY}
        snapToGrid={snapToGrid}
        gridSize={gridSize}
        area={calcularAreaTotal()}
        titulo={planoInfo.titulo}
      />
    </div>
  )
}

function StatusBar({ elementos, selectedIds, zoom, panX, panY, snapToGrid, gridSize, area, titulo }) {
  return (
    <div className="status-bar">
      <div className="status-bar__item">
        <span className="status-bar__label">Zoom:</span>
        <span className="status-bar__value">{(zoom * 100).toFixed(0)}%</span>
      </div>
      <div className="status-bar__item">
        <span className="status-bar__label">X:</span>
        <span className="status-bar__value">{Math.round(panX)}</span>
      </div>
      <div className="status-bar__item">
        <span className="status-bar__label">Y:</span>
        <span className="status-bar__value">{Math.round(panY)}</span>
      </div>
      <div className="status-bar__item">
        <span className="status-bar__label">Área:</span>
        <span className="status-bar__value">{area}</span>
      </div>
      <div className="status-bar__item">
        <span className="status-bar__label">Grid:</span>
        <span className="status-bar__value">
          {snapToGrid ? `${gridSize / 100}m` : 'Off'}
        </span>
      </div>
      <div className="status-bar__item">
        <span className="status-bar__label">Elementos:</span>
        <span className="status-bar__value">{elementos.length}</span>
      </div>
      {selectedIds.length > 0 && (
        <div className="status-bar__item">
          <span className="status-bar__label">Seleccionados:</span>
          <span className="status-bar__value">{selectedIds.length}</span>
        </div>
      )}
      <div style={{ marginLeft: 'auto' }} className="status-bar__item">
        <span className="status-bar__value">{titulo}</span>
      </div>
    </div>
  )
}

export default EditorCAD