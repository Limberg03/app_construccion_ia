import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { login as loginApi, me as meApi, register as registerApi } from '../api/auth'

const ACCESS_TOKEN_KEY = 'dpap.access'
const REFRESH_TOKEN_KEY = 'dpap.refresh'

const AuthContext = createContext(null)

function safeGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => safeGet(ACCESS_TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const isAuthenticated = Boolean(token)

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }

    let alive = true
    setIsLoading(true)

    meApi()
      .then((u) => {
        if (!alive) return
        setUser(u)
      })
      .catch(() => {
        if (!alive) return
        safeRemove(ACCESS_TOKEN_KEY)
        safeRemove(REFRESH_TOKEN_KEY)
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        if (!alive) return
        setIsLoading(false)
      })

    return () => {
      alive = false
    }
  }, [token])

  const login = async ({ correo, password }) => {
    setIsLoading(true)
    try {
      const data = await loginApi({ correo, password })
      if (data?.access) {
        safeSet(ACCESS_TOKEN_KEY, data.access)
        setToken(data.access)
      }
      if (data?.refresh) safeSet(REFRESH_TOKEN_KEY, data.refresh)
      return data
    } finally {
      setIsLoading(false)
    }
  }

  // Registro reutilizable para cualquier vista de auth.
  const register = async (payload) => {
    setIsLoading(true)
    try {
      return await registerApi(payload)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    safeRemove(ACCESS_TOKEN_KEY)
    safeRemove(REFRESH_TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated,
      isLoading,
      login,
      register,
      logout,
    }),
    [token, user, isAuthenticated, isLoading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider />')
  return ctx
}
