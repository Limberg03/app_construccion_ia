/**
 * Canvas CAD Profesional
 * Renderiza el plano con estilo arquitectónico avanzado usando SVG
 * Soporta zoom, pan, cuadrícula profesional y elementos detallados.
 * Integra un panel de navegación superior y herramientas de canvas.
 */
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { PanelNavigation } from './PanelNavigation'; // Importar el nuevo panel
import { CanvasToolbar } from './CanvasToolbar'; // Importar herramientas de canvas
import { SearchIcon, ZoomInIcon, ZoomOutIcon } from './Icons'; // Iconos de ejemplo
import './EditorCanvas.css'; // Asegúrate de tener estilos para los nuevos componentes

// Constante de escala para consistencia
const SCALE = 100; // 100px = 1 metro

export function EditorCanvas() {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Estado del store
  const elementos = useEditorStore((s) => s.elementos);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const addElemento = useEditorStore((s) => s.addElemento);
  const herramientaActiva = useEditorStore((s) => s.herramientaActiva);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const setPan = useEditorStore((s) => s.setPan);
  const setZoom = useEditorStore((s) => s.setZoom);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const gridSize = useEditorStore((s) => s.gridSize);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const capas = useEditorStore((s) => s.capas);

  // Estado local para interaccion
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [drawingElement, setDrawingElement] = useState(null);

  // Efecto para centrar el canvas inicialmente (opcional)
  useEffect(() => {
    // Lógica para centrar el plano en el contenedor al cargar
    // console.log('Canvas cargado. Implementar centrado inicial aquí.');
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // CUADRÍCULA PROFESIONAL
  // ═══════════════════════════════════════════════════════════════
  const gridLines = useMemo(() => {
    if (!gridVisible) return null;

    const lines = [];
    const width = 8000; // Aumentar tamaño para planos grandes
    const height = 6000;
    const majorStep = gridSize * SCALE; // Líneas principales cada metro
    const minorStep = majorStep / 5;   // Líneas secundarias cada 20cm

    // Líneas secundarias (más tenues)
    for (let x = 0; x <= width; x += minorStep) {
      if (x % majorStep !== 0) { // Evitar superponer con principales
        lines.push(
          <line
            key={`vx-minor-${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={height}
            className="grid-line grid-line--minor"
          />
        );
      }
    }
    for (let y = 0; y <= height; y += minorStep) {
      if (y % majorStep !== 0) {
        lines.push(
          <line
            key={`hy-minor-${y}`}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            className="grid-line grid-line--minor"
          />
        );
      }
    }

    // Líneas principales (más marcadas)
    for (let x = 0; x <= width; x += majorStep) {
      lines.push(
        <line
          key={`vx-major-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={height}
          className="grid-line grid-line--major"
        />
      );
    }
    for (let y = 0; y <= height; y += majorStep) {
      lines.push(
        <line
          key={`hy-major-${y}`}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          className="grid-line grid-line--major"
        />
      );
    }

    return <g className="grid-group">{lines}</g>;
  }, [gridVisible, gridSize]); // Zoom no debe afectar el cálculo de líneas, solo su visualización

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZADO DE MURO DETALLADO
  // ═══════════════════════════════════════════════════════════════
  const Muro = ({ elemento }) => {
    if (!capas.muros) return null;
    const isSelected = selectedIds.includes(elemento.id);
    return (
      <g className="muro-group">
        {/* Sombra proyectada para efecto 3D sutil */}
        <rect
          x={elemento.x + 3}
          y={elemento.y + 3}
          width={elemento.width}
          height={elemento.height}
          className="muro-shadow"
        />
        {/* Muro principal con relleno y borde */}
        <rect
          x={elemento.x}
          y={elemento.y}
          width={elemento.width}
          height={elemento.height}
          className={`muro-rect ${isSelected ? 'seleccion' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (herramientaActiva === 'select') {
              setSelectedIds(elemento.id);
            }
          }}
        />
        {/* Marcadores de selección profesionales */}
        {isSelected && (
          <g className="seleccion-handles-group">
            <rect x={elemento.x - 3} y={elemento.y - 3} width={6} height={6} className="seleccion-handle-rect" />
            <rect x={elemento.x + elemento.width - 3} y={elemento.y - 3} width={6} height={6} className="seleccion-handle-rect" />
            <rect x={elemento.x - 3} y={elemento.y + elemento.height - 3} width={6} height={6} className="seleccion-handle-rect" />
            <rect x={elemento.x + elemento.width - 3} y={elemento.y + elemento.height - 3} width={6} height={6} className="seleccion-handle-rect" />
          </g>
        )}
      </g>
    );
  };

  // ... (Implementaciones similares para Puerta y Ventana, mejorando su estética) ...
  const Puerta = ({ elemento }) => {
    if (!capas.puertas) return null;
    const isSelected = selectedIds.includes(elemento.id);
    // ... lógica de renderizado detallado de puerta ...
    return <g><rect x={elemento.x} y={elemento.y} width={elemento.width} height={elemento.height} fill="blue" /></g>; // Placeholder
  };

  const Ventana = ({ elemento }) => {
    if (!capas.ventanas) return null;
    const isSelected = selectedIds.includes(elemento.id);
    // ... lógica de renderizado detallado de ventana ...
    return <g><rect x={elemento.x} y={elemento.y} width={elemento.width} height={elemento.height} fill="green" /></g>; // Placeholder
  };

  // ═══════════════════════════════════════════════════════════════
  // ELEMENTOS RENDERIZADOS
  // ═══════════════════════════════════════════════════════════════
  const elementosRender = useMemo(() => {
    return elementos.map((el) => {
      switch (el.tipo) {
        case 'muro':
          return <Muro key={el.id} elemento={el} />;
        case 'puerta':
          return <Puerta key={el.id} elemento={el} />;
        case 'ventana':
          return <Ventana key={el.id} elemento={el} />;
        default:
          return null;
      }
    });
  }, [elementos, selectedIds, herramientaActiva]);

  // ═══════════════════════════════════════════════════════════════
  // EVENTOS DE INTERACCION
  // ═══════════════════════════════════════════════════════════════
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(zoom * delta);
  }, [zoom, setZoom]);

  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      // Middle click o shift+click para pan
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    } else if (e.button === 0 && herramientaActiva === 'muro') {
      // Empezar a dibujar muro
      const rect = svgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - panX) / zoom;
      const y = (e.clientY - rect.top - panY) / zoom;
      setDrawingElement({ tipo: 'muro', x, y, width: 0, height: 15 }); // Altura de muro por defecto
    } else if (e.button === 0 && herramientaActiva === 'select') {
      // Click en canvas limpia seleccion
      clearSelection();
    }
  }, [herramientaActiva, panX, panY, zoom, clearSelection]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      setPan(e.clientX - panStart.x, e.clientY - panStart.y);
    } else if (drawingElement) {
      const rect = svgRef.current.getBoundingClientRect();
      let x = (e.clientX - rect.left - panX) / zoom;
      let y = (e.clientY - rect.top - panY) / zoom;

      if (snapToGrid) {
        x = Math.round(x / gridSize) * gridSize;
        y = Math.round(y / gridSize) * gridSize;
      }

      const width = x - drawingElement.x;
      const height = drawingElement.height;

      setDrawingElement({
        ...drawingElement,
        width: width,
        height,
      });
    }
  }, [isPanning, panStart, drawingElement, panX, panY, zoom, snapToGrid, gridSize, setPan]);

  const handleMouseUp = useCallback((e) => {
    if (isPanning) {
      setIsPanning(false);
    } else if (drawingElement && Math.abs(drawingElement.width) > 5) { // Evitar muros diminutos
      addElemento(drawingElement);
    }
    setDrawingElement(null);
  }, [isPanning, drawingElement, addElemento]);

  // Cursor según herramienta
  const cursorClass = useMemo(() => {
    if (isPanning) return 'editor-canvas-area--grabbing';
    switch (herramientaActiva) {
      case 'select': return 'default';
      case 'muro': return 'crosshair';
      default: return 'crosshair';
    }
  }, [herramientaActiva, isPanning]);

  return (
    <div className="editor-layout">
      {/* 1. Panel de Navegación Superior Profesional */}
      <PanelNavigation title="Generador de Planos de Casas" />

      <div className="editor-content">
        {/* 2. Barra de Herramientas de Canvas Lateral */}
        <CanvasToolbar />

        {/* 3. Área del Canvas SVG */}
        <div
          ref={containerRef}
          className={`editor-canvas-area ${cursorClass}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="architecture-canvas"
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Fondo del canvas */}
            <rect width="100%" height="100%" fill="var(--canvas-bg)" />

            {/* Cuadrícula Profesional */}
            {gridLines}

            {/* Elementos del plano */}
            <g className="elementos-group">{elementosRender}</g>

            {/* Elemento en dibujo (previsualización) */}
            {drawingElement && (
              <rect
                x={Math.min(drawingElement.x, drawingElement.x + drawingElement.width)}
                y={Math.min(drawingElement.y, drawingElement.y + drawingElement.height)}
                width={Math.abs(drawingElement.width)}
                height={Math.abs(drawingElement.height)}
                className="drawing-preview-rect"
              />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
