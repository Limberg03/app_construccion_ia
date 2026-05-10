import { Button } from '../../ui/Button'
import { Table } from '../../ui/Table'

import { ProyectoCard } from './ProyectoCard'

export function ListaProyectos({
  proyectos = [],
  view = 'cards',
  onCreate,
  onPreview,
  onEdit,
  onDelete,
  onRefresh,
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Proyectos</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Gestiona tus proyectos y su información básica.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            Recargar
          </Button>
          <Button size="sm" onClick={onCreate}>
            Nuevo
          </Button>
        </div>
      </div>

      {view === 'table' ? (
        <div className="mt-4">
          <Table
            columns={[
              { key: 'titulo', header: 'Título' },
              { key: 'descripcion', header: 'Descripción' },
              {
                key: 'fechaCreacion',
                header: 'Creado',
                render: (p) =>
                  p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleString() : '—',
              },
            ]}
            rows={proyectos}
            rowKey="id"
            renderActions={(p) => (
              <div className="inline-flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => onPreview?.(p)}>
                  Visualización previa
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onEdit?.(p)}>
                  Editar
                </Button>
                <Button variant="danger" size="sm" onClick={() => onDelete?.(p)}>
                  Eliminar
                </Button>
              </div>
            )}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {proyectos.map((p) => (
            <ProyectoCard
              key={p.id}
              proyecto={p}
              onPreview={() => onPreview?.(p)}
              onEdit={() => onEdit?.(p)}
              onDelete={() => onDelete?.(p)}
            />
          ))}
        </div>
      )}

      {proyectos.length === 0 && (
        <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          No tienes proyectos todavía.
        </div>
      )}
    </section>
  )
}
