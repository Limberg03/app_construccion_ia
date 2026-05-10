import { useMemo, useState } from 'react'

import { Button } from '../../ui/Button'

export function PlanoChatbotPanel({ history, isComposing, error, onSend, onClose }) {
  const [input, setInput] = useState('')

  const disabled = isComposing || !input.trim()

  const onSubmit = async (e) => {
    e.preventDefault()
    if (disabled) return
    const msg = input.trim()
    setInput('')
    await onSend?.(msg)
  }

  const rows = useMemo(() => history ?? [], [history])

  return (
    <div className="w-80 rounded-2xl border border-slate-700 bg-slate-950/95 backdrop-blur shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <div className="text-sm font-semibold text-white">Asistente de Plano</div>
          <div className="text-xs text-slate-400">Edicion por lenguaje natural</div>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>
      </div>

      <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-2">
        {rows.length === 0 ? (
          <div className="text-xs text-slate-500">Escribe: "agrega una puerta" o "mueve la ventana".</div>
        ) : (
          rows.map((item, idx) => (
            <div
              key={`${item.role}-${idx}`}
              className={[
                'text-xs rounded-xl px-3 py-2',
                item.role === 'user'
                  ? 'bg-slate-800 text-slate-100 text-right'
                  : 'bg-slate-900 text-slate-300',
              ].join(' ')}
            >
              {item.content}
            </div>
          ))
        )}
      </div>

      {error ? (
        <div className="px-4 pb-2 text-xs text-rose-400">{error}</div>
      ) : null}

      <form onSubmit={onSubmit} className="flex gap-2 px-4 pb-4">
        <input
          className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100"
          placeholder="Ej: agrega una ventana"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={disabled}>
          {isComposing ? '...' : 'Enviar'}
        </Button>
      </form>
    </div>
  )
}
