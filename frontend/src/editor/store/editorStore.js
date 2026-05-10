/**
 * EditorStore - Store global para el editor de planos
 * Usa Zustand para estado reactivo y persistencia de preferencias
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Constantes
const HERRAMIENTAS = {
  SELECT: 'select',
  MURO: 'muro',
  PUERTA: 'puerta',
  VENTANA: 'ventana',
  TEXTO: 'texto',
  COTA: 'cota',
  SIMBOLO: 'simbolo',
}

const DEFAULT_ZOOM = 1
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const GRID_SIZE = 100 // px por metro

// Estado inicial de elementos
const initialElements = [
  { id: 'm1', tipo: 'muro', x: 100, y: 100, width: 300, height: 20 },
  { id: 'm2', tipo: 'muro', x: 100, y: 100, width: 20, height: 200 },
  { id: 'm3', tipo: 'muro', x: 380, y: 100, width: 20, height: 200 },
  { id: 'm4', tipo: 'muro', x: 100, y: 280, width: 300, height: 20 },
  { id: 'p1', tipo: 'puerta', x: 180, y: 100, width: 80, height: 20 },
  { id: 'v1', tipo: 'ventana', x: 280, y: 100, width: 60, height: 20 },
]

export const useEditorStore = create(
  persist(
    (set, get) => ({
      // ═══════════════════════════════════════════════════
      // HERRAMIENTA ACTIVA
      // ═══════════════════════════════════════════════════
      herramientaActiva: HERRAMIENTAS.SELECT,
      setHerramienta: (herramienta) => set({ herramientaActiva: herramienta }),

      // ═══════════════════════════════════════════════════
      // ELEMENTOS DEL PLANO
      // ═══════════════════════════════════════════════════
      elementos: initialElements,
      setElementos: (elementos) => set({ elementos }),

      addElemento: (elemento) => set((state) => ({
        elementos: [...state.elementos, { ...elemento, id: `el_${Date.now()}` }],
      })),

      updateElemento: (id, updates) => set((state) => ({
        elementos: state.elementos.map((el) =>
          el.id === id ? { ...el, ...updates } : el
        ),
      })),

      deleteElemento: (id) => set((state) => ({
        elementos: state.elementos.filter((el) => el.id !== id),
      })),

      deleteElementos: (ids) => set((state) => ({
        elementos: state.elementos.filter((el) => !ids.includes(el.id)),
      })),

      clearAll: () => set({ elementos: [] }),

      // ═══════════════════════════════════════════════════
      // SELECCIÓN
      // ═══════════════════════════════════════════════════
      selectedIds: [],
      setSelectedIds: (ids) => set({ selectedIds: Array.isArray(ids) ? ids : [ids] }),
      addToSelection: (id) => set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds
          : [...state.selectedIds, id],
      })),
      removeFromSelection: (id) => set((state) => ({
        selectedIds: state.selectedIds.filter((sid) => sid !== id),
      })),
      clearSelection: () => set({ selectedIds: [] }),
      selectAll: () => set((state) => ({
        selectedIds: state.elementos.map((el) => el.id),
      })),

      // ═══════════════════════════════════════════════════
      // VISTA (zoom, pan)
      // ═══════════════════════════════════════════════════
      zoom: DEFAULT_ZOOM,
      panX: 0,
      panY: 0,

      setZoom: (zoom) => set((state) => ({
        zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)),
      })),

      zoomIn: () => set((state) => ({
        zoom: Math.min(MAX_ZOOM, state.zoom * 1.2),
      })),

      zoomOut: () => set((state) => ({
        zoom: Math.max(MIN_ZOOM, state.zoom / 1.2),
      })),

      resetZoom: () => set({ zoom: DEFAULT_ZOOM, panX: 0, panY: 0 }),

      setPan: (x, y) => set({ panX: x, panY: y }),

      pan: (dx, dy) => set((state) => ({
        panX: state.panX + dx,
        panY: state.panY + dy,
      })),

      // ═══════════════════════════════════════════════════
      // GRID
      // ═══════════════════════════════════════════════════
      gridVisible: true,
      gridSize: GRID_SIZE,
      snapToGrid: true,
      snapToVertices: true,

      toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
      setGridSize: (size) => set({ gridSize: size }),
      toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
      toggleSnapToVertices: () => set((state) => ({ snapToVertices: !state.snapToVertices })),

      // ═══════════════════════════════════════════════════
      // TEMA
      // ═══════════════════════════════════════════════════
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({
        theme: state.theme === 'light' ? 'dark' : 'light',
      })),

      // ═══════════════════════════════════════════════════
      // CAPAS
      // ═══════════════════════════════════════════════════
      capas: {
        grid: true,
        muros: true,
        puertas: true,
        ventanas: true,
        cotas: true,
        etiquetas: true,
        simbolos: true,
      },
      toggleCapa: (capa) => set((state) => ({
        capas: { ...state.capas, [capa]: !state.capas[capa] },
      })),

      // ═══════════════════════════════════════════════════
      // INFO DEL PLANO
      // ═══════════════════════════════════════════════════
      planoInfo: {
        titulo: 'Plano de Prueba',
        ubicacion: 'Sin ubicación',
        escala: '1:100',
        unidades: 'metros',
      },
      setPlanoInfo: (info) => set((state) => ({
        planoInfo: { ...state.planoInfo, ...info },
      })),

      // ═══════════════════════════════════════════════════
      // HISTORIAL (undo/redo)
      // ═══════════════════════════════════════════════════
      history: [],
      historyIndex: -1,

      pushHistory: () => set((state) => {
        const newHistory = state.history.slice(0, state.historyIndex + 1)
        newHistory.push([...state.elementos])
        return {
          history: newHistory.slice(-50), // Max 50 estados
          historyIndex: newHistory.length - 1,
        }
      }),

      undo: () => set((state) => {
        if (state.historyIndex <= 0) return state
        const newIndex = state.historyIndex - 1
        return {
          elementos: [...state.history[newIndex]],
          historyIndex: newIndex,
        }
      }),

      redo: () => set((state) => {
        if (state.historyIndex >= state.history.length - 1) return state
        const newIndex = state.historyIndex + 1
        return {
          elementos: [...state.history[newIndex]],
          historyIndex: newIndex,
        }
      }),

      canUndo: () => get().historyIndex > 0,
      canRedo: () => get().historyIndex < get().history.length - 1,
    }),
    {
      name: 'editor-preferences',
      partialize: (state) => ({
        theme: state.theme,
        gridVisible: state.gridVisible,
        gridSize: state.gridSize,
        snapToGrid: state.snapToGrid,
        snapToVertices: state.snapToVertices,
      }),
    }
  )
)

// Selectores reutilizables
export const selectHerramienta = (state) => state.herramientaActiva
export const selectElementos = (state) => state.elementos
export const selectSelectedIds = (state) => state.selectedIds
export const selectZoom = (state) => state.zoom
export const selectTheme = (state) => state.theme
export const selectPlanoInfo = (state) => state.planoInfo