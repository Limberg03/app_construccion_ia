/* ─────────────────────────────────────────────
   RegisterPage — Formulario de registro
   Validación en cliente + envío al backend
   ───────────────────────────────────────────── */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

/* ── Validación de todos los campos del formulario ── */
function validarFormulario({ nombre, apellido, correo, password, confirmarPassword }) {
  const errores = {}

  if (!nombre.trim())    errores.nombre   = 'El nombre es obligatorio.'
  if (!apellido.trim())  errores.apellido = 'El apellido es obligatorio.'

  if (!correo.trim()) {
    errores.correo = 'El correo es obligatorio.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    errores.correo = 'Ingresa un correo válido.'
  }

  if (!password) {
    errores.password = 'La contraseña es obligatoria.'
  } else if (password.length < 6) {
    errores.password = 'Mínimo 6 caracteres.'
  }

  if (!confirmarPassword) {
    errores.confirmarPassword = 'Confirma tu contraseña.'
  } else if (password !== confirmarPassword) {
    errores.confirmarPassword = 'Las contraseñas no coinciden.'
  }

  return errores
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const { pushToast } = useToast()

  const [isLoading, setIsLoading] = useState(false)

  /* Estado de cada campo del formulario */
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    correo: '',
    password: '',
    confirmarPassword: '',
  })
  const [errors, setErrors] = useState({})

  /* Actualiza un campo y limpia su error */
  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  /* Envío del formulario */
  const onSubmit = async (event) => {
    event.preventDefault()

    /* Valida en el cliente primero */
    const validationErrors = validarFormulario(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      pushToast({ type: 'warning', title: 'Revisa los campos', message: 'Hay datos incompletos o inválidos.' })
      return
    }

    setIsLoading(true)
    try {
      /* Envía al backend y redirige al login */
      await register({
        nombre:   form.nombre.trim(),
        apellido: form.apellido.trim(),
        correo:   form.correo.trim().toLowerCase(),
        password: form.password,
      })
      pushToast({ type: 'success', title: 'Cuenta creada', message: 'Ya puedes iniciar sesión.' })
      navigate('/login')
    } catch (error) {
      /* Muestra errores del backend por campo */
      const data = error?.response?.data ?? {}
      const backendErrors = {}
      if (typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
          if (Array.isArray(value) && value.length > 0) backendErrors[key] = String(value[0])
          else if (typeof value === 'string') backendErrors[key] = value
        }
      }
      setErrors((prev) => ({ ...prev, ...backendErrors }))
      pushToast({ type: 'error', title: 'No se pudo registrar', message: backendErrors?.correo || 'Verifica los datos.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Registra tus datos para acceder al panel de gestión de proyectos."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-sky-400 hover:text-sky-300 transition-colors">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Nombre y apellido en fila */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nombre"   value={form.nombre}   onChange={onChange('nombre')}   error={errors.nombre}   required />
          <Input label="Apellido" value={form.apellido} onChange={onChange('apellido')} error={errors.apellido} required />
        </div>

        <Input
          label="Correo electrónico"
          type="email"
          value={form.correo}
          onChange={onChange('correo')}
          placeholder="nombre@empresa.com"
          error={errors.correo}
          required
        />

        {/* Contraseñas en fila */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Contraseña"
            type="password"
            value={form.password}
            onChange={onChange('password')}
            placeholder="Mínimo 6 caracteres"
            error={errors.password}
            required
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            value={form.confirmarPassword}
            onChange={onChange('confirmarPassword')}
            placeholder="Repite la contraseña"
            error={errors.confirmarPassword}
            required
          />
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? 'Creando cuenta…' : 'Registrarme'}
        </Button>
      </form>
    </AuthLayout>
  )
}
