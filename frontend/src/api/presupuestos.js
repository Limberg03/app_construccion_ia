import { http } from './config'

const BASE = '/api/presupuestos/'

export async function getPresupuestoItems(presupuestoId) {
  if (!presupuestoId) return []
  const res = await http.get(`${BASE}${presupuestoId}/items/`)
  return res.data
}

export async function getPresupuestosByProyecto(proyectoId) {
  const res = await http.get(BASE, { params: { proyecto: proyectoId } })
  return res.data
}

export async function createPresupuesto(data) {
  const res = await http.post(BASE, data)
  return res.data
}

export async function generarPresupuestoAutomatico(presupuestoId, modo = 'hibrido') {
  const res = await http.post(`${BASE}${presupuestoId}/generar-automatico/`, { modo })
  return res.data
}

export async function refinarPresupuestoDesdePlano(presupuestoId) {
  const res = await http.post(`${BASE}${presupuestoId}/refinar-desde-plano/`)
  return res.data
}

export async function getPresupuestoTotal(presupuestoId) {
  const res = await http.get(`${BASE}${presupuestoId}/total/`)
  return res.data
}
