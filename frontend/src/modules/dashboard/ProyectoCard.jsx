import { Button } from '../../ui/Button'

export function ProyectoCard({ proyecto, onPreview, onEdit, onDelete }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-900 dark:text-white truncate">
            {proyecto.titulo}
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
            {proyecto.descripcion}
          </div>
          {proyecto.fechaCreacion && (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {new Date(proyecto.fechaCreacion).toLocaleString()}
            </div>
          )}
        </div>

        <div className="shrink-0 flex gap-2">
          <Button variant="secondary" size="sm" onClick={onPreview}>
            Visualización previa
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Editar
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  )
}
