import { http } from './config'

const BASE = '/api/proyectos/'

export async function getProyectos() {
  const res = await http.get(BASE)
  return res.data
}

export async function getProyecto(id) {
  const res = await http.get(`${BASE}${id}/`)
  return res.data
}

export async function createProyecto(data) {
  const res = await http.post(BASE, data)
  return res.data
}

export async function updateProyecto(id, data) {
  const res = await http.patch(`${BASE}${id}/`, data)
  return res.data
}

export async function deleteProyecto(id) {
  const res = await http.delete(`${BASE}${id}/`)
  return res.data
}
