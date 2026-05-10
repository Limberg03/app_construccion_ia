/* ═══════════════════════════════════════════════════
   DashboardPage — Panel principal de proyectos
   Tema: oscuro futurista / construcción
   ═══════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth }       from '../hooks/useAuth.jsx'
import { useToast }      from '../hooks/useToast.jsx'
import { useProyectos }  from '../hooks/useProyectos'
import { getPresupuestoItems } from '../api/presupuestos'
import { EstimacionModal } from '../modules/dashboard/EstimacionModal'
import { ProyectoPreview }     from '../dashboard/ProyectoPreview'
import { Button } from '../ui/Button'
import { Input }  from '../ui/Input'
import { Modal }  from '../ui/Modal'

/* ─── Iconos SVG inline ─────────────────────────── */

function IconHome(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    </svg>
  )
}

function IconExit(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m-3 3l-3 3m3-3H9" />
    </svg>
  )
}

function IconPlus(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function IconFolder(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M2.25 7.5A2.25 2.25 0 014.5 5.25h5.379c.597 0 1.169.237 1.591.659l1.12 1.12c.422.422.994.659 1.591.659H19.5A2.25 2.25 0 0121.75 9.75v8.25A2.25 2.25 0 0119.5 20.25h-15A2.25 2.25 0 012.25 18V7.5z" />
    </svg>
  )
}

function IconCheckCircle(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12.75l2.25 2.25L15 9.75m6 2.25a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconClock(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 6v6l4 2.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconMoney(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconSearch(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.1 5.1a7.5 7.5 0 0011.55 11.55z" />
    </svg>
  )
}

function IconCalendar(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M8.25 3.75v3m7.5-3v3M3.75 9.75h16.5M5.25 6.75h13.5A1.5 1.5 0 0120.25 8.25v10.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5z" />
    </svg>
  )
}

function IconMenu(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

function IconClose(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function IconActivity(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 12h4l3-9 4 18 3-9h4" />
    </svg>
  )
}

function IconCrane(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 3v12M4 7l8-4 8 4M4 7v10a1 1 0 001 1h14a1 1 0 001-1V7" />
    </svg>
  )
}

/* ─── Helpers de formato ─────────────────────────── */

/* Deduce estado del proyecto por palabras clave */
function toStatus(proyecto) {
  const text = `${proyecto?.titulo ?? ''} ${proyecto?.descripcion ?? ''}`.toLowerCase()
  if (/final|terminad|cerrad|completad/.test(text)) return 'finalizado'
  if (/pendient|espera|planificad|borrador/.test(text)) return 'pendiente'
  return 'activo'
}

/* Formatea una fecha en español */
function formatDate(value) {
  if (!value) return 'Sin fecha'
  try {
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(value))
  } catch {
    return 'Sin fecha'
  }
}

/* Formatea moneda boliviana */
function formatMoney(value) {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency', currency: 'BOB', maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

/* ─── Componente: Badge de estado ──────────────────── */
function StatusBadge({ status }) {
  const styles = {
    activo:     'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
    pendiente:  'bg-amber-500/15  text-amber-400  border border-amber-500/25',
    finalizado: 'bg-slate-500/15  text-slate-400  border border-slate-500/25',
  }
  return (
    <span className={[
      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
      styles[status] ?? styles.activo,
    ].join(' ')}>
      {status}
    </span>
  )
}

/* ─── Componente: Tarjeta de estadística ───────────── */
function StatCard({ icon: Icon, title, value, helper, accentColor }) {
  /* accentColor ejemplos: 'sky', 'emerald', 'violet', 'amber' */
  const colorMap = {
    sky:     { border: 'border-sky-500/20',     bg: 'bg-sky-500/10',     icon: 'text-sky-400',     glow: 'shadow-sky-500/10' },
    emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/10', icon: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
    violet:  { border: 'border-violet-500/20',  bg: 'bg-violet-500/10',  icon: 'text-violet-400',  glow: 'shadow-violet-500/10' },
    amber:   { border: 'border-amber-500/20',   bg: 'bg-amber-500/10',   icon: 'text-amber-400',   glow: 'shadow-amber-500/10' },
  }
  const c = colorMap[accentColor] ?? colorMap.sky

  return (
    <article className={[
      'rounded-2xl border p-5 shadow-lg transition-transform duration-200 hover:-translate-y-0.5',
      'bg-[#0d1526]',
      c.border, c.glow,
    ].join(' ')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          <p className="mt-1.5 text-xs text-slate-500">{helper}</p>
        </div>
        {/* Icono con fondo de color */}
        <span className={[
          'inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl',
          c.bg, c.icon,
        ].join(' ')}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  )
}

/* ─── Componente: Tarjeta de proyecto ──────────────── */
function ProjectCard({ proyecto, onPreview, onEdit, onDelete, onOpenEditor, onOpenEstimacion }) {
  const status = toStatus(proyecto)

  /* Color de acento según el estado */
  const accentLine = {
    activo:     'bg-emerald-500',
    pendiente:  'bg-amber-500',
    finalizado: 'bg-slate-500',
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/8 bg-[#0d1526] shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-sky-500/10">
      {/* Línea de color en el borde superior según estado */}
      <div className={['absolute left-0 top-0 h-0.5 w-full', accentLine[status] ?? accentLine.activo].join(' ')} />

      <div className="p-5">
        {/* Encabezado: título + badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="truncate text-base font-semibold text-white">{proyecto.titulo}</h4>
            <p className="mt-1 line-clamp-2 text-sm text-slate-400">{proyecto.descripcion}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Meta-datos: fecha de creación */}
        <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
          <IconCalendar className="h-3.5 w-3.5" />
          <span>{formatDate(proyecto.fechaCreacion)}</span>
        </div>

        {/* Acciones */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onPreview(proyecto)}>Vista previa</Button>
          <Button size="sm" variant="secondary" onClick={() => onEdit(proyecto)}>Editar</Button>
          <Button size="sm" variant="secondary" onClick={() => onOpenEstimacion(proyecto)}>Estimación</Button>
          <Button size="sm" onClick={() => onOpenEditor(proyecto)}>Abrir editor</Button>
          <Button size="sm" variant="danger"    onClick={() => onDelete(proyecto)}>Eliminar</Button>
        </div>
      </div>
    </article>
  )
}

/* ─── Componente: Estado vacío ─────────────────────── */
function EmptyProjectsState({ onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/3 py-16 text-center">
      {/* Icono decorativo */}
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400">
        <IconCrane className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">Sin proyectos aún</h3>
      <p className="mt-2 max-w-xs text-sm text-slate-400">
        Crea tu primer proyecto para comenzar a organizar planos, materiales y presupuestos.
      </p>
      <div className="mt-6">
        <Button onClick={onCreate}>
          <IconPlus className="h-4 w-4" />
          Crear primer proyecto
        </Button>
      </div>
    </div>
  )
}

/* ─── Componente: Ítem del sidebar ─────────────────── */
function SidebarItem({ icon: Icon, label, onClick, collapsed }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={[
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
        'text-slate-400 transition-all duration-150',
        'hover:bg-white/8 hover:text-white',
      ].join(' ')}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </button>
  )
}

/* ═══════════════════════════════════════════════════
   DashboardPage — Componente principal
   ═══════════════════════════════════════════════════ */
export function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout }                            = useAuth()
  const { pushToast }                               = useToast()
  const { items, isLoading, error, create, update, remove } = useProyectos()

  /* Estado de la UI */
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const [search,       setSearch]       = useState('')
  const [presupuestoTotal, setPresupuestoTotal] = useState(0)

  /* Estado del modal de crear/editar */
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [previewing, setPreviewing] = useState(null)
  const [estimacioning, setEstimacioning] = useState(null)
  const [titulo,     setTitulo]     = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')

  /* Carga el total del presupuesto desde la API */
  useEffect(() => {
    let active = true
    getPresupuestoItems()
      .then((rows) => {
        if (!active) return
        const total = (Array.isArray(rows) ? rows : []).reduce(
          (acc, item) => acc + Number(item?.subtotal ?? 0), 0
        )
        setPresupuestoTotal(total)
      })
      .catch(() => { if (active) setPresupuestoTotal(0) })
    return () => { active = false }
  }, [items.length])

  /* Filtra proyectos por búsqueda */
  const proyectos = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((p) => {
      const t = String(p.titulo ?? '').toLowerCase()
      const d = String(p.descripcion ?? '').toLowerCase()
      return t.includes(q) || d.includes(q)
    })
  }, [items, search])

  /* Resumen estadístico */
  const resumen = useMemo(() => {
    let activos = 0, finalizados = 0
    items.forEach((p) => {
      const s = toStatus(p)
      if (s === 'finalizado') finalizados++
      else if (s === 'activo') activos++
    })
    return { total: items.length, activos, finalizados, presupuesto: presupuestoTotal }
  }, [items, presupuestoTotal])

  /* Últimos 5 proyectos para actividad reciente */
  const actividadReciente = useMemo(() =>
    [...items].slice(0, 5).map((p) => ({
      id:   p.id,
      text: p.titulo,
      fecha: formatDate(p.fechaCreacion),
      status: toStatus(p),
    })), [items]
  )

  /* Extrae iniciales del usuario */
  const initials = useMemo(() => {
    const name  = `${user?.nombre ?? ''} ${user?.apellido ?? ''}`.trim()
    const base  = (name || user?.correo || 'U').trim()
    const parts = base.split(/\s+/).filter(Boolean)
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'U'
  }, [user])

  /* ── Acciones del modal ── */
  const openCreate = () => {
    setEditing(null); setTitulo(''); setDescripcion(''); setFormError(''); setModalOpen(true)
  }
  const openEdit = (p) => {
    setEditing(p); setPreviewing(null)
    setTitulo(p.titulo ?? ''); setDescripcion(p.descripcion ?? '')
    setFormError(''); setModalOpen(true)
  }
  const openPreview = (p) => setPreviewing(p)
  const openEstimacion = (p) => setEstimacioning(p)

  const onDelete = (p) => {
    if (!window.confirm(`¿Eliminar el proyecto "${p.titulo}"?`)) return
    remove(p.id)
      .then(() => pushToast({ type: 'success', title: 'Eliminado', message: 'Proyecto eliminado.' }))
      .catch(() => pushToast({ type: 'error', title: 'Error', message: 'No se pudo eliminar.' }))
  }

  const save = async () => {
    setFormError('')
    if (!titulo.trim() || !descripcion.trim()) { setFormError('Completa título y descripción'); return }
    setSaving(true)
    try {
      if (editing) {
        await update(editing.id, { titulo, descripcion })
        pushToast({ type: 'success', title: 'Actualizado', message: 'Cambios guardados.' })
      } else {
        await create({ titulo, descripcion })
        pushToast({ type: 'success', title: 'Proyecto creado', message: 'Ya aparece en tu tablero.' })
      }
      setModalOpen(false)
    } catch {
      setFormError('No se pudo guardar el proyecto')
    } finally {
      setSaving(false)
    }
  }

  const openEditor = (p) => navigate(`/proyecto/${p.id}/editor`)

  /* ── Anchos del sidebar ── */
  const sidebarW = sidebarOpen ? 'w-56' : 'w-16'
  const mainML   = sidebarOpen ? 'ml-56' : 'ml-16'

  return (
    /* Fondo general de la app */
    <div className="min-h-screen bg-[#060d1a] text-white">

      {/* ════ SIDEBAR ════ */}
      <aside className={[
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/8 bg-[#0a1121]',
        'transition-all duration-300 ease-in-out',
        sidebarW,
      ].join(' ')}>

        {/* Logo / nombre */}
        <div className="flex h-16 flex-shrink-0 items-center gap-3 px-4 border-b border-white/8">
          {/* Cuadrado de marca */}
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white">
            <IconCrane className="h-4 w-4" />
          </div>
          {sidebarOpen && (
            <span className="truncate text-sm font-bold text-white">
              Plano {'>'} Presupuesto
            </span>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          <SidebarItem icon={IconHome}   label="Proyectos" onClick={() => {}} collapsed={!sidebarOpen} />
          <SidebarItem icon={IconActivity} label="Actividad" onClick={() => {}} collapsed={!sidebarOpen} />
        </nav>

        {/* Botón de cerrar sesión */}
        <div className="border-t border-white/8 px-2 py-4">
          <SidebarItem
            icon={IconExit}
            label="Cerrar sesión"
            collapsed={!sidebarOpen}
            onClick={() => {
              pushToast({ type: 'warning', title: 'Sesión cerrada', message: 'Hasta pronto.' })
              logout()
            }}
          />
        </div>
      </aside>

      {/* ════ TOPBAR ════ */}
      <header className={[
        'fixed top-0 z-30 flex h-16 items-center gap-3 border-b border-white/8 bg-[#060d1a]/90 backdrop-blur px-5',
        'transition-all duration-300',
        mainML, 'right-0',
      ].join(' ')}>
        {/* Toggle sidebar */}
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/8 hover:text-white transition-colors"
          aria-label="Toggle menú"
        >
          {sidebarOpen ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>

        {/* Título de sección */}
        <span className="hidden text-sm font-semibold text-white sm:block">Dashboard</span>

        <div className="flex-1" />

        {/* Avatar + correo del usuario */}
        <div className="flex items-center gap-3">
          <div className="hidden text-sm text-slate-400 sm:block">{user?.correo}</div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-300 ring-1 ring-sky-500/30">
            {initials}
          </div>
        </div>
      </header>

      {/* ════ CONTENIDO PRINCIPAL ════ */}
      <main className={[
        'pt-16 transition-all duration-300 min-h-screen',
        mainML,
      ].join(' ')}>
        <div className="mx-auto max-w-7xl px-5 py-8 space-y-6">

          {/* ── Encabezado de bienvenida ── */}
          <section className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Hola, <span className="text-gradient-primary">{user?.nombre ?? 'Constructor'}</span> 👷
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Panel de gestión de proyectos · {new Date().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <Button onClick={openCreate}>
              <IconPlus className="h-4 w-4" />
              Nuevo proyecto
            </Button>
          </section>

          {/* ── Tarjetas de estadísticas ── */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={IconFolder}
              title="Total proyectos"
              value={resumen.total}
              helper="Todos los proyectos registrados"
              accentColor="sky"
            />
            <StatCard
              icon={IconCheckCircle}
              title="Proyectos activos"
              value={resumen.activos}
              helper="En ejecución o progreso"
              accentColor="emerald"
            />
            <StatCard
              icon={IconClock}
              title="Finalizados"
              value={resumen.finalizados}
              helper="Marcados como completados"
              accentColor="violet"
            />
            <StatCard
              icon={IconMoney}
              title="Presupuesto Bs."
              value={formatMoney(resumen.presupuesto)}
              helper="Suma total de presupuestos"
              accentColor="amber"
            />
          </section>

          {/* ── Lista de proyectos ── */}
          <section className="rounded-2xl border border-white/8 bg-[#0a1121] p-6">
            {/* Encabezado de sección */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Mis proyectos</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} encontrado{proyectos.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Búsqueda con icono */}
              <div className="relative w-full max-w-xs">
                <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar proyecto…"
                  className={[
                    'w-full h-10 rounded-xl pl-9 pr-4',
                    'bg-white/5 text-white placeholder:text-slate-500',
                    'border border-white/10 outline-none',
                    'focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20',
                    'transition-all duration-200 text-sm',
                  ].join(' ')}
                />
              </div>
            </div>

            {/* Error de carga */}
            {error && (
              <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
                Error al cargar proyectos: {error}
              </div>
            )}

            {/* Skeleton de carga */}
            {isLoading ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : proyectos.length === 0 ? (
              <div className="mt-6">
                <EmptyProjectsState onCreate={openCreate} />
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {proyectos.map((proyecto) => (
                  <ProjectCard
                    key={proyecto.id}
                    proyecto={proyecto}
                    onPreview={openPreview}
                    onEdit={openEdit}
                    onDelete={onDelete}
                    onOpenEditor={openEditor}
                    onOpenEstimacion={openEstimacion}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Sección inferior: Actividad + Consejo ── */}
          <section className="grid gap-4 lg:grid-cols-2">
            {/* Actividad reciente */}
            <article className="rounded-2xl border border-white/8 bg-[#0a1121] p-6">
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <IconActivity className="h-4 w-4 text-sky-400" />
                Actividad reciente
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">Últimos proyectos registrados.</p>

              <div className="mt-4 space-y-2">
                {actividadReciente.length === 0 ? (
                  <div className="rounded-xl bg-white/4 px-4 py-3 text-sm text-slate-500">
                    Sin actividad aún. Crea tu primer proyecto.
                  </div>
                ) : (
                  actividadReciente.map((row) => (
                    <div key={row.id}
                      className="flex items-center justify-between rounded-xl border border-white/6 bg-white/4 px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{row.text}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{row.fecha}</div>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>
                  ))
                )}
              </div>
            </article>

            {/* Consejo rápido con acento construcción */}
            <article className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0a1121] p-6">
              {/* Brillo de fondo decorativo */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/8 blur-2xl" />

              <div className="relative">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Consejo rápido
                </span>

                <h3 className="mt-4 text-base font-semibold text-white">
                  Mantén tus proyectos organizados
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-400">
                  Descripciones claras y estados consistentes mejoran el seguimiento
                  y ayudan a estimar mejor costos y plazos de construcción.
                </p>

                <div className="mt-5">
                  <Button variant="secondary" onClick={openCreate}>
                    <IconPlus className="h-4 w-4" />
                    Crear proyecto ahora
                  </Button>
                </div>
              </div>
            </article>
          </section>
        </div>
      </main>

      {/* ── Preview de proyecto ── */}
      <ProyectoPreview proyecto={previewing} onClose={() => setPreviewing(null)} />

      {/* ── Modal de estimación ── */}
      <EstimacionModal
        open={!!estimacioning}
        onClose={() => setEstimacioning(null)}
        proyecto={estimacioning}
      />

      {/* ── Modal crear/editar proyecto ── */}
      <Modal
        open={modalOpen}
        title={editing ? 'Editar proyecto' : 'Nuevo proyecto'}
        onClose={() => (saving ? null : setModalOpen(false))}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        }
      >
        {/* Error del formulario */}
        {formError && (
          <div className="mb-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
            {formError}
          </div>
        )}

        <div className="space-y-3">
          <Input
            label="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Casa 120m²"
          />
          <Input
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Vivienda unifamiliar en zona sur"
          />
        </div>
      </Modal>
    </div>
  )
}
