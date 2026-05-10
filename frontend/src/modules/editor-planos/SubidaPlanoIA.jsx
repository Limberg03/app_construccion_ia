import { useMemo, useRef, useState } from 'react'

import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'

const ESPACIOS_EXTERIORES = [
  'porche delantero',
  'patio cubierto',
  'terraza',
  'balcon',
  'patio',
  'pasillo cubierto',
  'cocina exterior',
]

function toInt(value) {
  const num = Number.parseInt(value, 10)
  if (Number.isNaN(num) || num < 0) return undefined
  return num
}

export function SubidaPlanoIA({ isProcessing, onUpload, error }) {
  const inputRef = useRef(null)

  const [modalOpen, setModalOpen] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)

  const [modo, setModo] = useState('image')
  const [prompt, setPrompt] = useState('')
  const [estilo, setEstilo] = useState('contemporaneo')
  const [areaM2, setAreaM2] = useState('140')
  const [pisos, setPisos] = useState('2')
  const [dormitorios, setDormitorios] = useState('2')
  const [banos, setBanos] = useState('1')
  const [tipoTecho, setTipoTecho] = useState('techo inclinado')
  const [cimientos, setCimientos] = useState('losa')
  const [garaje, setGaraje] = useState('1')
  const [cocina, setCocina] = useState('abierta')
  const [espacios, setEspacios] = useState(['balcon'])

  const soloImagen = modo === 'image'
  const soloIndicaciones = modo === 'text'
  const hibrido = modo === 'hybrid'

  const opciones = useMemo(() => {
    const data = {
      estilo,
      area_m2: toInt(areaM2),
      pisos: toInt(pisos),
      dormitorios: toInt(dormitorios),
      banos: toInt(banos),
      tipo_techo: tipoTecho,
      cimientos,
      garaje: toInt(garaje),
      cocina,
      espacios_exteriores: espacios,
    }
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined && value !== '')
    )
  }, [areaM2, banos, cimientos, cocina, dormitorios, estilo, espacios, garaje, pisos, tipoTecho])

  const puedeGenerar = useMemo(() => {
    if (isProcessing) return false
    if (soloImagen) return Boolean(file)
    if (soloIndicaciones) return Boolean(prompt.trim() || Object.keys(opciones).length)
    if (hibrido) return Boolean(file) && Boolean(prompt.trim() || Object.keys(opciones).length)
    return false
  }, [file, hibrido, isProcessing, opciones, prompt, soloImagen, soloIndicaciones])

  const onPick = () => {
    if (isProcessing || soloIndicaciones) return
    inputRef.current?.click()
  }

  const handleFile = (nextFile) => {
    if (!nextFile || isProcessing) return
    setFile(nextFile)
  }

  const handleToggleEspacio = (espacio) => {
    setEspacios((prev) => {
      if (prev.includes(espacio)) return prev.filter((item) => item !== espacio)
      return [...prev, espacio]
    })
  }

  const handleGenerar = () => {
    if (isProcessing) return

    const payload = { modo }
    if (!soloImagen) {
      payload.prompt = prompt.trim()
      payload.opciones = opciones
    }
    if (!soloIndicaciones && file) payload.file = file

    onUpload?.(payload)
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-center">
        <h2 className="text-xl font-semibold text-white">Generar con IA</h2>
        <p className="mt-2 text-sm text-slate-300">
          Configura cómo quieres generar el plano y abre el asistente en modal.
        </p>

        <div className="mt-5 flex justify-center">
          <Button onClick={() => setModalOpen(true)}>Abrir generador IA</Button>
        </div>

        {error ? (
          <div
            className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-left text-sm text-rose-300"
            role="alert"
          >
            {error}
          </div>
        ) : null}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Generador de Planos con IA"
        maxWidthClass="max-w-5xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={handleGenerar} disabled={!puedeGenerar}>
              {isProcessing
                ? 'Procesando...'
                : (soloImagen
                  ? 'Generar desde imagen'
                  : (soloIndicaciones ? 'Generar desde indicaciones' : 'Generar hibrido'))}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-300">Modo</label>
            <select
              value={modo}
              onChange={(e) => {
                const next = e.target.value
                setModo(next)
                if (next === 'text') setFile(null)
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="image">Solo imagen</option>
              <option value="hybrid">Hibrido (imagen + indicaciones)</option>
              <option value="text">Solo indicaciones</option>
            </select>
          </div>

          {(soloIndicaciones || hibrido) ? (
            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-300">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="Ej: Casa contemporanea con sala amplia y patio posterior..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-300">Estilo</label>
                <select
                  value={estilo}
                  onChange={(e) => setEstilo(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="contemporaneo">Contemporaneo</option>
                  <option value="moderno">Moderno</option>
                  <option value="colonial">Colonial</option>
                  <option value="cabana">Cabana</option>
                  <option value="artesano">Artesano</option>
                  <option value="costero">Costero</option>
                  <option value="casa de campo">Casa de campo</option>
                </select>
              </div>

              <div className="lg:col-span-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-300">
                  Area m2
                  <input value={areaM2} onChange={(e) => setAreaM2(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100" />
                </label>
                <label className="text-xs text-slate-300">
                  Pisos
                  <input value={pisos} onChange={(e) => setPisos(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100" />
                </label>
                <label className="text-xs text-slate-300">
                  Dormitorios
                  <input value={dormitorios} onChange={(e) => setDormitorios(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100" />
                </label>
                <label className="text-xs text-slate-300">
                  Banos
                  <input value={banos} onChange={(e) => setBanos(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100" />
                </label>
                <label className="text-xs text-slate-300">
                  Techo
                  <select value={tipoTecho} onChange={(e) => setTipoTecho(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100">
                    <option value="techo inclinado">Techo inclinado</option>
                    <option value="techo plano">Techo plano</option>
                    <option value="techo a dos aguas">Techo a dos aguas</option>
                    <option value="techo a cuatro aguas">Techo a cuatro aguas</option>
                  </select>
                </label>
                <label className="text-xs text-slate-300">
                  Cimientos
                  <select value={cimientos} onChange={(e) => setCimientos(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100">
                    <option value="losa">Losa</option>
                    <option value="sotano">Sotano</option>
                  </select>
                </label>
                <label className="text-xs text-slate-300">
                  Garaje
                  <input value={garaje} onChange={(e) => setGaraje(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100" />
                </label>
                <label className="text-xs text-slate-300">
                  Cocina
                  <select value={cocina} onChange={(e) => setCocina(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100">
                    <option value="abierta">Abierta</option>
                    <option value="cerrada">Cerrada</option>
                  </select>
                </label>
              </div>

              <div className="lg:col-span-2">
                <div className="mb-2 text-xs uppercase tracking-wide text-slate-300">Espacios exteriores</div>
                <div className="flex flex-wrap gap-2">
                  {ESPACIOS_EXTERIORES.map((espacio) => (
                    <button
                      key={espacio}
                      type="button"
                      onClick={() => handleToggleEspacio(espacio)}
                      className={[
                        'rounded-full border px-3 py-1 text-xs transition',
                        espacios.includes(espacio)
                          ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500',
                      ].join(' ')}
                    >
                      {espacio}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {(soloImagen || hibrido) ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">

              {/* Banner informativo solo en modo imagen puro */}
              {soloImagen && (
                <div className="flex items-start gap-3 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.001 3.001 0 00-.765 1.77A4.5 4.5 0 0112 21a4.5 4.5 0 01-3.324-7.347l-.345-.346z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-sky-300">Análisis automático — sin configuración</p>
                    <p className="mt-0.5 text-xs text-sky-400/80">
                      La IA interpreta el plano con un prompt inteligente predefinido. Solo sube la imagen y obtendrás muros, puertas y ventanas detectados automáticamente.
                    </p>
                  </div>
                </div>
              )}

              <label className="block text-xs uppercase tracking-wide text-slate-300">Imagen del plano</label>
              <button
                type="button"
                onClick={onPick}
                disabled={isProcessing}
                onDragEnter={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOver(true)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOver(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOver(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOver(false)
                  const dropped = e.dataTransfer?.files?.[0]
                  handleFile(dropped)
                }}
                className={[
                  'w-full rounded-2xl border-2 border-dashed p-8 text-left transition',
                  'bg-slate-950/60',
                  dragOver ? 'border-sky-400' : (file ? 'border-sky-600' : 'border-slate-700'),
                  isProcessing ? 'opacity-70 cursor-not-allowed' : 'hover:border-slate-500',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-6">
                  <div>
                    <div className={['text-base font-semibold', file ? 'text-sky-300' : 'text-white'].join(' ')}>
                      {file ? `✓ ${file.name}` : 'Arrastra tu plano aquí o haz clic para seleccionar'}
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      JPG, PNG · Máx. 10 MB
                    </div>
                  </div>

                  {isProcessing ? (
                    <div className="flex items-center gap-3 text-sm text-slate-200">
                      <div className="h-5 w-5 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                      Analizando…
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>

              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          ) : null}

          {error ? (
            <div
              className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {isProcessing ? (
            <div className="text-sm text-slate-300">
              La IA esta procesando tu solicitud... esto puede tomar unos segundos.
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}
