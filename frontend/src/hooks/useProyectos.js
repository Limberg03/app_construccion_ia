import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  createProyecto,
  deleteProyecto,
  getProyectos,
  updateProyecto,
} from '../api/proyectos'

function toErrorMessage(err) {
  return (
    err?.response?.data?.detail ||
    err?.message ||
    'Ocurrió un error inesperado'
  )
}

export function useProyectos() {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await getProyectos()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(String(toErrorMessage(err)))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(async (payload) => {
    setError('')
    const created = await createProyecto(payload)
    setItems((prev) => [created, ...prev])
    return created
  }, [])

  const update = useCallback(async (id, payload) => {
    setError('')
    const updated = await updateProyecto(id, payload)
    setItems((prev) => prev.map((p) => (p.id === id ? updated : p)))
    return updated
  }, [])

  const remove = useCallback(async (id) => {
    setError('')
    await deleteProyecto(id)
    setItems((prev) => prev.filter((p) => p.id !== id))
    return true
  }, [])

  return useMemo(
    () => ({
      items,
      isLoading,
      error,
      refresh,
      create,
      update,
      remove,
    }),
    [items, isLoading, error, refresh, create, update, remove]
  )
}
