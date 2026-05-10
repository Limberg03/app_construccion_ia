import { Button } from '../../ui/Button'

export function SeleccionMetodo({ onIA, onManual, onBack }) {
  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <div className="mb-6">
          {typeof onBack === 'function' ? (
            <div className="mb-4">
              <Button variant="secondary" size="sm" onClick={onBack}>
                Atrás
              </Button>
            </div>
          ) : null}

          <div className="text-xl font-semibold text-white">Editor de Planos</div>
          <div className="mt-1 text-sm text-slate-300">
            Elige cómo quieres generar los datos vectoriales del plano.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <div className="text-lg font-semibold text-white">Generar con IA</div>
            <div className="mt-2 text-sm text-slate-300">
              Sube una imagen del plano y genera un JSON vectorial de prueba.
            </div>
            <div className="mt-5">
              <Button className="w-full" onClick={onIA}>
                Generar con IA
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <div className="text-lg font-semibold text-white">Crear Manualmente</div>
            <div className="mt-2 text-sm text-slate-300">
              Empieza con un lienzo vacío y agrega muros manualmente.
            </div>
            <div className="mt-5">
              <Button variant="secondary" className="w-full" onClick={onManual}>
                Crear Manualmente
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
