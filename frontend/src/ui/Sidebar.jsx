import { Button } from './Button'

export function Sidebar({ user, onLogout }) {
  return (
    <aside className="h-full w-64 shrink-0 bg-slate-950 text-white border-r border-slate-900">
      <div className="p-5">
        <div className="text-sm font-semibold tracking-wide text-white/90">
          De Plano a Presupuesto
        </div>
        <div className="mt-1 text-xs text-white/60">Módulo 1</div>

        <div className="mt-6 rounded-xl bg-white/5 border border-white/10 p-3">
          <div className="text-xs text-white/60">Sesión</div>
          <div className="mt-1 text-sm font-medium text-white truncate">
            {user?.correo ?? '—'}
          </div>
          <div className="text-xs text-white/60 truncate">
            {user?.nombre ? `${user.nombre} ${user.apellido ?? ''}` : ''}
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="text-xs uppercase tracking-wider text-white/40">Navegación</div>
          <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm">
            Proyectos
          </div>
        </div>

        <div className="mt-8">
          <Button variant="secondary" size="sm" className="w-full" onClick={onLogout}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </aside>
  )
}
