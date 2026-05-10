/**
 * Toolbar profesional para el editor de planos
 * Barra de herramientas con iconos y tooltips
 */
import { useEditorStore } from '../store/editorStore'

// Iconos SVG inline - estilo línea fina
const Iconos = {
  Select: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M5 3l14 9-6 2-3 6z" />
    </svg>
  ),
  Muro: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="9" width="18" height="6" rx="1" />
    </svg>
  ),
  Puerta: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="4" y="8" width="10" height="12" rx="1" />
      <path d="M4 8 Q14 8 14 20" />
      <circle cx="6" cy="16" r="1" fill="currentColor" />
    </svg>
  ),
  Ventana: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="4" y="8" width="16" height="8" rx="1" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  ),
  Texto: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M4 6h16M8 6v12M12 6v12M16 6v12" />
    </svg>
  ),
  Cota: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M4 12h16M4 8v8M20 8v8M4 12h-3M20 12h3" />
    </svg>
  ),
  Simbolo: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="6" y="10" width="12" height="8" rx="1" />
      <path d="M6 10l3-4h6l3 4" />
    </svg>
  ),
  Grid: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
    </svg>
  ),
  Snap: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    </svg>
  ),
  ZoomIn: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="10" cy="10" r="7" />
      <path d="M21 21l-4.35-4.35M10 7v6M7 10h6" />
    </svg>
  ),
  ZoomOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="10" cy="10" r="7" />
      <path d="M21 21l-4.35-4.35M7 10h6" />
    </svg>
  ),
  Reset: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  ),
  Undo: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M3 7h18M3 7l5-5M3 7l5 5" />
    </svg>
  ),
  Redo: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M21 7H3M21 7l-5-5M21 7l-5 5" />
    </svg>
  ),
  Delete: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M4 6h16M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  Sun: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  ),
  Moon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  Save: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  ),
}

export function EditorToolbar() {
  const herramientaActiva = useEditorStore((s) => s.herramientaActiva)
  const setHerramienta = useEditorStore((s) => s.setHerramienta)
  const zoom = useEditorStore((s) => s.zoom)
  const zoomIn = useEditorStore((s) => s.zoomIn)
  const zoomOut = useEditorStore((s) => s.zoomOut)
  const resetZoom = useEditorStore((s) => s.resetZoom)
  const gridVisible = useEditorStore((s) => s.gridVisible)
  const toggleGrid = useEditorStore((s) => s.toggleGrid)
  const snapToGrid = useEditorStore((s) => s.snapToGrid)
  const toggleSnapToGrid = useEditorStore((s) => s.toggleSnapToGrid)
  const theme = useEditorStore((s) => s.theme)
  const toggleTheme = useEditorStore((s) => s.toggleTheme)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.canUndo)
  const canRedo = useEditorStore((s) => s.canRedo)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const deleteElementos = useEditorStore((s) => s.deleteElementos)

  const herramientas = [
    { id: 'select', icon: 'Select', label: 'Seleccionar' },
    { id: 'muro', icon: 'Muro', label: 'Dibujar Muro' },
    { id: 'puerta', icon: 'Puerta', label: 'Insertar Puerta' },
    { id: 'ventana', icon: 'Ventana', label: 'Insertar Ventana' },
    { id: 'texto', icon: 'Texto', label: 'Insertar Texto' },
    { id: 'cota', icon: 'Cota', label: 'Insertar Cota' },
    { id: 'simbolo', icon: 'Simbolo', label: 'Insertar Símbolo' },
  ]

  const handleDelete = () => {
    if (selectedIds.length > 0) {
      deleteElementos(selectedIds)
    }
  }

  return (
    <div className="editor-toolbar">
      {/* Titulo */}
      <span className="editor-toolbar__title">Editor de Planos</span>

      {/* Herramientas de dibujo */}
      <div className="editor-toolbar__group">
        {herramientas.map((h) => (
          <button
            key={h.id}
            className={`editor-toolbar__btn tooltip ${herramientaActiva === h.id ? 'editor-toolbar__btn--active' : ''}`}
            onClick={() => setHerramienta(h.id)}
            title={h.label}
          >
            {Iconos[h.icon] && <Iconos[h.icon] />}
            <span className="tooltip__content">{h.label}</span>
          </button>
        ))}
      </div>

      {/* Acciones */}
      <div className="editor-toolbar__group">
        <button
          className="editor-toolbar__btn tooltip"
          onClick={undo}
          disabled={!canUndo()}
          title="Deshacer"
        >
          <Iconos.Undo />
          <span className="tooltip__content">Deshacer</span>
        </button>
        <button
          className="editor-toolbar__btn tooltip"
          onClick={redo}
          disabled={!canRedo()}
          title="Rehacer"
        >
          <Iconos.Redo />
          <span className="tooltip__content">Rehacer</span>
        </button>
        <button
          className="editor-toolbar__btn tooltip"
          onClick={handleDelete}
          disabled={selectedIds.length === 0}
          title="Eliminar seleccionado"
        >
          <Iconos.Delete />
          <span className="tooltip__content">Eliminar</span>
        </button>
      </div>

      {/* Vista */}
      <div className="editor-toolbar__group">
        <button
          className={`editor-toolbar__btn tooltip ${gridVisible ? 'editor-toolbar__btn--active' : ''}`}
          onClick={toggleGrid}
          title="Mostrar/Ocultar Grid"
        >
          <Iconos.Grid />
          <span className="tooltip__content">Grid</span>
        </button>
        <button
          className={`editor-toolbar__btn tooltip ${snapToGrid ? 'editor-toolbar__btn--active' : ''}`}
          onClick={toggleSnapToGrid}
          title="Ajustar a Grid"
        >
          <Iconos.Snap />
          <span className="tooltip__content">Snap</span>
        </button>
      </div>

      {/* Zoom */}
      <div className="editor-toolbar__group">
        <button className="editor-toolbar__btn tooltip" onClick={zoomOut} title="Zoom -">
          <Iconos.ZoomOut />
          <span className="tooltip__content">Zoom -</span>
        </button>
        <span className="zoom-controls__value">{(zoom * 100).toFixed(0)}%</span>
        <button className="editor-toolbar__btn tooltip" onClick={zoomIn} title="Zoom +">
          <Iconos.ZoomIn />
          <span className="tooltip__content">Zoom +</span>
        </button>
        <button className="editor-toolbar__btn tooltip" onClick={resetZoom} title="Reset Zoom">
          <Iconos.Reset />
          <span className="tooltip__content">Reset</span>
        </button>
      </div>

      {/* Tema y guardar */}
      <div className="editor-toolbar__group">
        <button
          className="editor-toolbar__btn tooltip"
          onClick={toggleTheme}
          title={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}
        >
          {theme === 'light' ? <Iconos.Moon /> : <Iconos.Sun />}
          <span className="tooltip__content">Cambiar tema</span>
        </button>
        <button className="editor-toolbar__btn tooltip" title="Guardar">
          <Iconos.Save />
          <span className="tooltip__content">Guardar</span>
        </button>
      </div>
    </div>
  )
}