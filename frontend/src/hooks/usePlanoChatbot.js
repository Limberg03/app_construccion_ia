import { useCallback, useRef, useState } from 'react'

import { chatbotPlano } from '../api/planos'

const INTENTO_MAPEO = {
  muro: 'muro',
  puerta: 'puerta',
  ventana: 'ventana',
}

function detectarIntencion(texto) {
  const t = texto.toLowerCase().trim()

  if (t.includes('deshacer') || t.includes('undo')) return 'undo'
  if (t.includes('rehacer') || t.includes('redo')) return 'redo'

  if (t.includes('mover') || t.includes('mueve') || t.includes('rotar') || t.includes('gira')) {
    if (t.includes('rot') || /(\d+)\s*°/.test(t)) return 'rotate'
    return 'move'
  }

  if (
    t.includes('cambia') ||
    t.includes('modifica') ||
    t.includes('actualiza') ||
    t.includes('pon') ||
    t.includes('coloca')
  ) {
    return 'edit'
  }

  if (t.includes('elimina') || t.includes('quita') || t.includes('borra') || t.includes('remove')) {
    return 'delete'
  }

  if (
    t.includes('pon') ||
    t.includes('coloca') ||
    t.includes('agrega') ||
    t.includes('anade') ||
    t.includes('crea') ||
    t.includes('haz')
  ) {
    return 'add'
  }

  if (t.includes('quiero') || t.includes('necesito') || t.includes('por favor')) {
    return 'add'
  }

  return null
}

function extraerTipo(texto, formasExistentes) {
  const t = texto.toLowerCase()

  for (const [patron, tipo] of Object.entries(INTENTO_MAPEO)) {
    if (t.includes(patron)) return tipo
  }

  const conteos = formasExistentes.reduce((acc, s) => {
    acc[s.tipo] = (acc[s.tipo] || 0) + 1
    return acc
  }, {})

  if (conteos.muro && conteos.puerta && !conteos.ventana) return 'ventana'
  if (conteos.muro && !conteos.puerta) return 'puerta'

  return null
}

function calcularPosicion(formas) {
  if (!formas.length) return { x: 100, y: 100 }

  const xs = formas.map((s) => s.x)
  const ys = formas.map((s) => s.y)
  const xMax = Math.max(...xs)
  const yMax = Math.max(...ys)
  const margen = 30

  return { x: xMax + margen, y: yMax + margen }
}

function calcularTamanoPorTipo(tipo) {
  const base = { width: 120, height: 80 }
  switch (tipo) {
    case 'puerta':
      return { ...base, width: 90, height: 200 }
    case 'ventana':
      return { ...base, width: 100, height: 80 }
    default:
      return base
  }
}

function parseMetric(valor) {
  if (!valor && valor !== 0) return null
  const n = Number(String(valor).replace(/,/g, '.'))
  return Number.isNaN(n) ? null : n
}

async function procesarSinIA({ userMessage, intencion, shapes }) {
  const tiposDetectados = Object.keys(INTENTO_MAPEO).filter((k) => userMessage.toLowerCase().includes(k))
  if (intencion === 'add' && tiposDetectados.length > 0) {
    const tipo = INTENTO_MAPEO[tiposDetectados[0]]
    const pos = calcularPosicion(shapes)
    return {
      action: 'add',
      tipo,
      x: pos.x,
      y: pos.y,
      ...calcularTamanoPorTipo(tipo),
      reply: `Aniadi ${tipo} en ${Math.round(pos.x)},${Math.round(pos.y)}`,
    }
  }

  const matchEdit = userMessage.match(/(puerta|ventana|muro).*?([0-9]+(?:\.[0-9]+)?)\s*(?:m|metros|px)/i)
  if (intencion === 'edit' && matchEdit) {
    const [, tipo, valor] = matchEdit
    return {
      action: 'edit',
      tipo,
      patch: { width: parseMetric(valor) },
      reply: `Actualice ${tipo} con ancho ${valor}`,
    }
  }

  return null
}

function ejecutarAccion(action, canvas, selectedId) {
  if (!action || !canvas) return

  switch (action.action) {
    case 'add': {
      const { tipo, x, y, width, height, rotation = 0 } = action
      const size = width && height ? { width, height } : calcularTamanoPorTipo(tipo)
      canvas.addRectangle({ x, y, width: size.width, height: size.height, tipo, rotation })
      break
    }
    case 'edit': {
      const id = action.id || selectedId
      if (!id) return
      const patch = action.patch || {}
      canvas.updateShape(id, patch)
      break
    }
    case 'delete': {
      const id = action.id || selectedId
      if (!id) return
      canvas.deleteShape(id)
      break
    }
    case 'move': {
      const id = action.id || selectedId
      if (!id) return
      canvas.updateShape(id, { x: action.x, y: action.y })
      break
    }
    case 'rotate': {
      const id = action.id || selectedId
      if (!id) return
      canvas.updateShape(id, { rotation: action.rotation })
      break
    }
    case 'undo':
      canvas.undo()
      break
    case 'redo':
      canvas.redo()
      break
    default:
      break
  }
}

export function usePlanoChatbot({ planoId, canvasRef }) {
  const [history, setHistory] = useState([])
  const [isComposing, setIsComposing] = useState(false)
  const [error, setError] = useState(null)
  const [suggestions, setSuggestions] = useState([])

  const historyRef = useRef(history)
  historyRef.current = history

  const processMessage = useCallback(
    async (userMessage) => {
      if (!userMessage || !userMessage.trim()) return

      setHistory((prev) => [...prev, { role: 'user', content: userMessage }])
      setIsComposing(true)
      setError(null)

      try {
        if (!canvasRef?.current) {
          throw new Error('Editor de planos no esta disponible.')
        }

        const canvas = canvasRef.current
        const shapes = canvas.getShapes ? canvas.getShapes() : []
        const selectedId = canvas.getSelectedTypeId ? canvas.getSelectedTypeId() : null

        let action = null
        if (planoId) {
          const respuesta = await chatbotPlano(planoId, {
            message: userMessage,
            shapes,
            selected_id: selectedId,
            history: historyRef.current,
          })
          if (respuesta && respuesta.action) {
            action = respuesta
          }
        }

        if (!action) {
          const intencion = detectarIntencion(userMessage)
          action = await procesarSinIA({ userMessage, intencion, shapes })
        }

        if (!action) {
          setHistory((prev) => [
            ...prev,
            { role: 'assistant', content: 'No entendi la solicitud. Intenta con: anadir una puerta, mover la ventana, deshacer.' },
          ])
          setIsComposing(false)
          return
        }

        if (action.action === 'ask' || action.action === 'none') {
          setHistory((prev) => [
            ...prev,
            { role: 'assistant', content: action.reply || 'Necesito mas detalles para continuar.' },
          ])
          setIsComposing(false)
          return
        }

        ejecutarAccion(action, canvas, selectedId)
        setHistory((prev) => [
          ...prev,
          { role: 'assistant', content: action.reply || 'Accion realizada.' },
        ])
      } catch (err) {
        setError(err?.message || 'Error al procesar la solicitud.')
        setHistory((prev) => [
          ...prev,
          { role: 'assistant', content: 'Ocurrio un error. Intenta mas tarde.' },
        ])
      } finally {
        setIsComposing(false)
      }
    },
    [canvasRef, planoId]
  )

  return {
    history,
    isComposing,
    error,
    suggestions,
    processMessage,
  }
}
