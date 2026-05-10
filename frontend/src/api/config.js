import axios from 'axios'

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (isLocalhost ? 'http://localhost:8000' : 'https://construccion-ia.onrender.com')
const ACCESS_TOKEN_KEY = 'dpap.access'

function getAccessToken() {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

export const http = axios.create({
  baseURL: API_BASE_URL,
})

http.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (!token) return config

  config.headers = config.headers ?? {}
  config.headers.Authorization = `Bearer ${token}`
  return config
})
