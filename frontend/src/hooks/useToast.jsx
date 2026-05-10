import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

let nextToastId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  // Agrega un toast global reutilizable para cualquier vista.
  const pushToast = useCallback(({ type = 'success', title, message, duration = 3200 }) => {
    const id = nextToastId
    nextToastId += 1

    setToasts((prev) => [
      ...prev,
      {
        id,
        type,
        title,
        message,
      },
    ])

    if (duration > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      toasts,
      pushToast,
      removeToast,
    }),
    [toasts, pushToast, removeToast]
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider />')
  return ctx
}
