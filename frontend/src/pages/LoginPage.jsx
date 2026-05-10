/* ─────────────────────────────────────────────
   LoginPage — Formulario de inicio de sesión
   Usa AuthLayout con diseño futurista
   ───────────────────────────────────────────── */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthLayout } from '../components/auth/AuthLayout'
import { useAuth } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading } = useAuth()
  const { pushToast } = useToast()

  const [correo, setCorreo]       = useState('')
  const [password, setPassword]   = useState('')
  const [errors, setErrors]       = useState({})

  /* Valida campos antes de enviar al backend */
  const submit = async (e) => {
    e.preventDefault()

    /* Validación local mínima */
    const nextErrors = {}
    if (!correo.trim()) nextErrors.correo   = 'El correo es obligatorio.'
    if (!password)      nextErrors.password = 'La contraseña es obligatoria.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      pushToast({ type: 'warning', title: 'Faltan datos', message: 'Completa los campos requeridos.' })
      return
    }

    setErrors({})

    try {
      /* Intenta login con el backend */
      await login({ correo: correo.trim().toLowerCase(), password })
      pushToast({ type: 'success', title: 'Sesión iniciada', message: 'Bienvenido al panel de proyectos.' })
      navigate('/')
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Credenciales inválidas.'
      pushToast({ type: 'error', title: 'Acceso denegado', message: String(msg) })
    }
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Accede con tu correo corporativo para gestionar proyectos y presupuestos."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="font-semibold text-sky-400 hover:text-sky-300 transition-colors">
            Regístrate aquí
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Input
          label="Correo electrónico"
          type="email"
          value={correo}
          onChange={(e) => {
            setCorreo(e.target.value)
            setErrors((prev) => ({ ...prev, correo: '' }))
          }}
          placeholder="nombre@empresa.com"
          error={errors.correo}
          required
        />

        <Input
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setErrors((prev) => ({ ...prev, password: '' }))
          }}
          placeholder="Tu contraseña"
          error={errors.password}
          required
        />

        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? 'Validando acceso…' : 'Ingresar al sistema'}
        </Button>
      </form>
    </AuthLayout>
  )
}
