import { http } from './config'

const BASE = '/api/planos/'

// Nota: en esta app el editor navega por proyectoId.
// Esta función devuelve el primer plano del proyecto; si no existe, crea uno.
export async function getPlano(proyectoId) {
  const res = await http.get(BASE, { params: { proyecto: proyectoId } })
  const list = Array.isArray(res.data) ? res.data : []
  if (list.length > 0) return list[0]

  const created = await http.post(BASE, {
    proyecto: proyectoId,
    nombre: 'Plano principal',
    datos_vectoriales: [],
  })
  return created.data
}

export async function updateDatosVectoriales(planoId, json) {
  const res = await http.patch(`${BASE}${planoId}/`, {
    datos_vectoriales: json,
  })
  return res.data
}

// IA real: soporta modo imagen, texto o híbrido.
export async function procesarPlanoIA(planoId, payload) {
  const form = new FormData()

  if (payload instanceof File) {
    form.append('file', payload)
    form.append('modo', 'image')
  } else {
    const data = payload ?? {}
    if (data.file) form.append('file', data.file)
    form.append('modo', data.modo || 'image')
    if (data.prompt) form.append('prompt', data.prompt)
    if (data.opciones && Object.keys(data.opciones).length > 0) {
      form.append('opciones', JSON.stringify(data.opciones))
    }
    if (data.escala_metros_por_pixel) {
      form.append('escala_metros_por_pixel', String(data.escala_metros_por_pixel))
    }
  }

  const res = await http.post(`${BASE}${planoId}/procesar-ia/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return res.data
}

/**
 * Punto 1 — Analiza una imagen de plano sin prompt del usuario.
 * Solo acepta el archivo; el prompt estático lo define el backend.
 * Endpoint dedicado: POST /api/planos/{id}/analizar-imagen/
 */
export async function analizarImagenPlano(planoId, file) {
  const form = new FormData()
  form.append('file', file)

  const res = await http.post(`${BASE}${planoId}/analizar-imagen/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return res.data
}

export async function chatbotPlano(planoId, payload) {
  const res = await http.post(`${BASE}${planoId}/chatbot/`, payload)
  return res.data
}
