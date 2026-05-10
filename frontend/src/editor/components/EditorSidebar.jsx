/**
 * Panel lateral de propiedades
 * Muestra información del elemento seleccionado y del plano
 */
import { useEditorStore } from '../store/editorStore'

export function EditorSidebar() {
  const elementos = useEditorStore((s) => s.elementos)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const updateElemento = useEditorStore((s) => s.updateElemento)
  const planoInfo = useEditorStore((s) => s.planoInfo)
  const setPlanoInfo = useEditorStore((s) => s.setPlanoInfo)
  const capas = useEditorStore((s) => s.capas)
  const toggleCapa = useEditorStore((s) => s.toggleCapa)

  const elementoSeleccionado = selectedIds.length === 1
    ? elementos.find((el) => el.id === selectedIds[0])
    : null

  const formatearMedida = (px) => {
    const metros = px / 100
    return `${metros.toFixed(2)} m`
  }

  return (
    <div className="editor-sidebar">
      {/* Info del plano */}
      <div className="editor-sidebar__section">
        <h3 className="editor-sidebar__title">Información del Plano</h3>
        <div className="editor-input__group">
          <input
            type="text"
            className="editor-input editor-input--sm"
            value={planoInfo.titulo}
            onChange={(e) => setPlanoInfo({ titulo: e.target.value })}
            placeholder="Título"
          />
        </div>
        <div className="editor-input__group">
          <input
            type="text"
            className="editor-input editor-input--sm"
            value={planoInfo.ubicacion}
            onChange={(e) => setPlanoInfo({ ubicacion: e.target.value })}
            placeholder="Ubicación"
          />
        </div>
        <div className="editor-input__group">
          <input
            type="text"
            className="editor-input editor-input--sm"
            value={planoInfo.escala}
            onChange={(e) => setPlanoInfo({ escala: e.target.value })}
            placeholder="Escala"
          />
        </div>
      </div>

      {/* Propiedades del elemento */}
      <div className="editor-sidebar__section">
        <h3 className="editor-sidebar__title">Propiedades</h3>

        {selectedIds.length === 0 ? (
          <p style={{ color: 'var(--ui-text-muted)', fontSize: '12px' }}>
            Selecciona un elemento para ver sus propiedades
          </p>
        ) : selectedIds.length > 1 ? (
          <p style={{ color: 'var(--ui-text-muted)', fontSize: '12px' }}>
            {selectedIds.length} elementos seleccionados
          </p>
        ) : elementoSeleccionado ? (
          <div className="editor-input__group">
            <label style={{ fontSize: '11px', color: 'var(--ui-text-muted)', marginBottom: '4px', display: 'block' }}>
              Tipo
            </label>
            <input
              type="text"
              className="editor-input editor-input--sm"
              value={elementoSeleccionado.tipo.toUpperCase()}
              disabled
            />
          </div>
        ) : null}

        {elementoSeleccionado && (
          <>
            <div className="editor-input__group">
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: 'var(--ui-text-muted)', marginBottom: '4px', display: 'block' }}>
                  Posición X
                </label>
                <input
                  type="number"
                  className="editor-input editor-input--sm"
                  value={Math.round(elementoSeleccionado.x)}
                  onChange={(e) => updateElemento(elementoSeleccionado.id, { x: Number(e.target.value) })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: 'var(--ui-text-muted)', marginBottom: '4px', display: 'block' }}>
                  Posición Y
                </label>
                <input
                  type="number"
                  className="editor-input editor-input--sm"
                  value={Math.round(elementoSeleccionado.y)}
                  onChange={(e) => updateElemento(elementoSeleccionado.id, { y: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="editor-input__group">
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: 'var(--ui-text-muted)', marginBottom: '4px', display: 'block' }}>
                  Ancho
                </label>
                <input
                  type="number"
                  className="editor-input editor-input--sm"
                  value={Math.round(elementoSeleccionado.width)}
                  onChange={(e) => updateElemento(elementoSeleccionado.id, { width: Number(e.target.value) })}
                />
                <span style={{ fontSize: '10px', color: 'var(--accent)' }}>
                  {formatearMedida(elementoSeleccionado.width)}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: 'var(--ui-text-muted)', marginBottom: '4px', display: 'block' }}>
                  Alto
                </label>
                <input
                  type="number"
                  className="editor-input editor-input--sm"
                  value={Math.round(elementoSeleccionado.height)}
                  onChange={(e) => updateElemento(elementoSeleccionado.id, { height: Number(e.target.value) })}
                />
                <span style={{ fontSize: '10px', color: 'var(--accent)' }}>
                  {formatearMedida(elementoSeleccionado.height)}
                </span>
              </div>
            </div>

            {elementoSeleccionado.tipo === 'muro' && (
              <div className="editor-input__group">
                <label style={{ fontSize: '11px', color: 'var(--ui-text-muted)', marginBottom: '4px', display: 'block' }}>
                  Espesor (m)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="0.5"
                  className="editor-input editor-input--sm"
                  value={(elementoSeleccionado.height / 100).toFixed(2)}
                  onChange={(e) => updateElemento(elementoSeleccionado.id, { height: Number(e.target.value) * 100 })}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Capas */}
      <div className="editor-sidebar__section">
        <h3 className="editor-sidebar__title">Capas</h3>
        {Object.entries(capas).map(([capa, visible]) => (
          <label
            key={capa}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={visible}
              onChange={() => toggleCapa(capa)}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: '12px', textTransform: 'capitalize' }}>
              {capa === 'muros' ? 'Muros' :
               capa === 'puertas' ? 'Puertas' :
               capa === 'ventanas' ? 'Ventanas' :
               capa === 'cotas' ? 'Cotas' :
               capa === 'etiquetas' ? 'Etiquetas' :
               capa === 'simbolos' ? 'Símbolos' : capa}
            </span>
          </label>
        ))}
      </div>

      {/* Estadisticas */}
      <div className="editor-sidebar__section">
        <h3 className="editor-sidebar__title">Estadísticas</h3>
        <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)' }}>
          <p>Total elementos: {elementos.length}</p>
          <p>Muros: {elementos.filter((el) => el.tipo === 'muro').length}</p>
          <p>Puertas: {elementos.filter((el) => el.tipo === 'puerta').length}</p>
          <p>Ventanas: {elementos.filter((el) => el.tipo === 'ventana').length}</p>
        </div>
      </div>
    </div>
  )
}