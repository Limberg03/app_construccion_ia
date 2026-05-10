/* ─────────────────────────────────────────────────
   EstimacionModal — Genera estimación de presupuesto
   para un plano/ambiente del proyecto.
   Muestra plano, ambiente, modo de cálculo y
   tabla de items resultantes con totales.
   ───────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from 'react'

import { http } from '../../api/config'
import { createPresupuesto, getPresupuestosByProyecto, generarPresupuestoAutomatico, getPresupuestoItems } from '../../api/presupuestos'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'

const MODOS = [
  { value: 'rapido',   label: 'Rápido' },
  { value: 'refinado', label: 'Refinado' },
  { value: 'hibrido',  label: 'Híbrido' },
]

const INFO_MODO = {
  rapido:   'Usa coeficientes base por m².',
  refinado: 'Considera muros, puertas y ventanas del plano.',
  hibrido:  'Ejecuta ambos métodos y compara resultados.',
}

/* Helper para formatear moneda */
function formatMoney(value) {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency', currency: 'BOB', maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function calcularTotalDesdeItems(items) {
  if (!Array.isArray(items) || items.length === 0) return 0

  // Trabajar en centavos para evitar errores de coma flotante.
  const totalCentavos = items.reduce((acc, item) => {
    const subtotal = Number(item?.subtotal)
    if (Number.isFinite(subtotal)) return acc + Math.round(subtotal * 100)

    const cantidad = Number(item?.cantidad)
    const precioUnit = Number(item?.precio_unitario)
    if (Number.isFinite(cantidad) && Number.isFinite(precioUnit)) {
      return acc + Math.round(cantidad * precioUnit * 100)
    }

    return acc
  }, 0)

  return totalCentavos / 100
}

/* Helper para mostrar errores */
function toErrorMessage(err) {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.non_field_errors?.join(', ') ||
    err?.message ||
    'Ocurrió un error inesperado'
  )
}

/* Componente: selector de modo */
function ModoSelector({ modo, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MODOS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={INFO_MODO[opt.value]}
          className={[
            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
            modo === opt.value
              ? 'border-sky-500/50 bg-sky-500/15 text-sky-400'
              : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/* Componente: tabla de items del presupuesto */
function ItemsTable({ items }) {
  if (!items || items.length === 0) return null

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-white mb-2">Materiales estimados</h4>
      <div className="overflow-x-auto rounded-lg border border-white/8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-white/5">
              <th className="px-3 py-2 text-left font-medium text-slate-400">Material</th>
              <th className="px-3 py-2 text-right font-medium text-slate-400">Cantidad</th>
              <th className="px-3 py-2 text-right font-medium text-slate-400">P. Unit (Bs)</th>
              <th className="px-3 py-2 text-right font-medium text-slate-400">SubTotal (Bs)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id ?? idx}
                className="border-b border-white/6 last:border-0 hover:bg-white/4"
              >
                <td className="px-3 py-2 text-slate-300">{item.material_nombre ?? item.material ?? '—'}</td>
                <td className="px-3 py-2 text-right text-slate-300">{item.cantidad ?? '—'}</td>
                <td className="px-3 py-2 text-right text-slate-300">{formatMoney(item.precio_unitario)}</td>
                <td className="px-3 py-2 text-right font-medium text-sky-400">{formatMoney(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   EstimacionModal — Componente principal
   ═══════════════════════════════════════════════════ */
export function EstimacionModal({ open, onClose, proyecto }) {
  const proyectoId = proyecto?.id

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modo, setModo] = useState('hibrido')

  const [planos, setPlanos] = useState([])
  const [presupuesto, setPresupuesto] = useState(null)
  const [items, setItems] = useState([])
  const [resumen, setResumen] = useState(null)
  const [generado, setGenerado] = useState(false)

  const handleExportarPDF = async () => {
    if (!presupuesto) return
    try {
      const res = await http.get(`/api/presupuestos/${presupuesto.id}/exportar-pdf/`, {
        responseType: 'blob', // Importante para recibir el archivo binario
      })
      
      // Crear un enlace temporal para forzar la descarga
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Presupuesto_${presupuesto.id}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
    } catch (e) {
      setError('Error al descargar el PDF')
    }
  }

  /* Carga planos y presupuestos del proyecto */
  useEffect(() => {
    if (!open || !proyectoId) return
    let cancelled = false

    setPlanos([])
    setPresupuesto(null)
    setItems([])
    setResumen(null)
    setGenerado(false)
    setError('')

    async function fetchData() {
      try {
        const [planosRes, presupuestosRes] = await Promise.all([
          http.get('/api/planos/', { params: { proyecto: proyectoId } }),
          getPresupuestosByProyecto(proyectoId),
        ])
        if (cancelled) return

        const planosData = Array.isArray(planosRes.data) ? planosRes.data : []
        let presupuestosData = Array.isArray(presupuestosRes) ? presupuestosRes : []

        // Si no hay presupuesto, crear uno automaticamente
        if (presupuestosData.length === 0) {
          try {
            const nuevo = await createPresupuesto({
              proyecto: proyectoId,
              nombre: `Presupuesto - ${proyecto?.titulo || 'Proyecto'}`,
            })
            presupuestosData = [nuevo]
          } catch (e) {
            if (!cancelled) setError('No se pudo crear el presupuesto')
            return
          }
        }

        setPlanos(planosData)
        
        const presupuestoActivo = presupuestosData[0]
        setPresupuesto(presupuestoActivo)

        // Cargar los items existentes para que no se borren visualmente
        if (presupuestoActivo) {
          const itemsData = await getPresupuestoItems(presupuestoActivo.id)
          if (!cancelled && itemsData && itemsData.length > 0) {
            setItems(itemsData)
            setGenerado(true)
          }
        }
      } catch (e) {
        if (!cancelled) setError(toErrorMessage(e))
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [open, proyectoId])

  /* Genera la estimación */
  const handleGenerar = useCallback(async () => {
    if (!presupuesto) {
      setError('No existe un presupuesto para este proyecto')
      return
    }
    setLoading(true)
    setError('')
    setItems([])
    setResumen(null)

    try {
      const data = await generarPresupuestoAutomatico(presupuesto.id, modo)
      setItems(Array.isArray(data.items) ? data.items : [])
      setResumen(data.resumen ?? null)
      setGenerado(true)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [presupuesto, modo])

  /* Resumen rápido modo rápido + refinado (hibrido) */
  const renderResumenHibrido = () => {
    if (!resumen || modo !== 'hibrido' || !resumen.rapido) return null
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
          <p className="text-xs font-medium text-emerald-400">Método rápido</p>
          <p className="mt-1 text-lg font-bold text-emerald-300">
            {formatMoney(resumen.rapido.total_estimado)}
          </p>
          <p className="mt-0.5 text-xs text-emerald-400/70">
            {resumen.rapido.items_creados} items · {resumen.rapido.area_m2?.toFixed(1)} m²
          </p>
        </div>
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
          <p className="text-xs font-medium text-sky-400">Método refinado</p>
          <p className="mt-1 text-lg font-bold text-sky-300">
            {formatMoney(resumen.refinado.total_estimado)}
          </p>
          <p className="mt-0.5 text-xs text-sky-400/70">
            {resumen.refinado.items_creados} items · factor {resumen.refinado.factor_refinado?.toFixed(2)}
          </p>
        </div>
      </div>
    )
  }

  const totalDesdeItems = calcularTotalDesdeItems(items)

  const totalDesdeResumen = (() => {
    if (!resumen) return 0
    if (modo === 'rapido') return resumen?.total_estimado ?? resumen?.rapido?.total_estimado ?? 0
    if (modo === 'refinado') return resumen?.total_estimado ?? resumen?.refinado?.total_estimado ?? 0
    if (modo === 'hibrido') return resumen?.refinado?.total_estimado ?? resumen?.rapido?.total_estimado ?? 0
    return resumen?.total_estimado ?? 0
  })()

  const totalEstimado = totalDesdeItems || totalDesdeResumen || presupuesto?.total || 0

  return (
    <Modal
      open={open}
      title="Estimación de Presupuesto"
      onClose={onClose}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Info del modo */}
          <p className="text-xs text-slate-400 max-w-sm">{INFO_MODO[modo]}</p>
          <div className="flex gap-2">
            {generado && (
              <Button variant="secondary" onClick={handleExportarPDF} className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                Descargar PDF
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              onClick={handleGenerar}
              disabled={loading || !presupuesto}
            >
              {loading ? 'Generando…' : generado ? 'Recalcular' : 'Generar estimación'}
            </Button>
          </div>
        </div>
      }
    >
      {/* Error general */}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* Info del proyecto */}
      <div className="mb-4 rounded-lg border border-white/8 bg-white/4 px-4 py-3">
        <p className="text-sm font-medium text-white">{proyecto?.titulo ?? 'Sin título'}</p>
        <p className="mt-0.5 text-xs text-slate-400">{proyecto?.descripcion ?? ''}</p>
      </div>

      {/* Selector de modo */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
          Modo de cálculo
        </p>
        <ModoSelector modo={modo} onChange={setModo} />
      </div>

      {/* Info de planos */}
      {planos.length === 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          Este proyecto no tiene planos cargados. Puedes subir uno en el editor.
        </div>
      )}

      {/* Indicador de estado */}
      {generado && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/10 px-4 py-3">
            <div>
              <p className="text-xs text-sky-400">Total estimado</p>
              <p className="mt-0.5 text-2xl font-bold text-sky-300">
                {formatMoney(totalEstimado)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-sky-400">Items</p>
              <p className="mt-0.5 text-xl font-semibold text-sky-300">
                {items.length}
              </p>
            </div>
          </div>

          {/* Comparativa hibrido */}
          {renderResumenHibrido()}

          {/* Tabla de materiales */}
          <ItemsTable items={items} />
        </div>
      )}
    </Modal>
  )
}