import { useState } from 'react'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { generarAlternativas } from '../../api/planos'

function MiniPlanoSVG({ vectorData, escalaMetrosPorPixel }) {
  if (!vectorData || !Array.isArray(vectorData) || vectorData.length === 0) {
    return <span className="text-xs text-slate-500 font-mono text-center">Sin geometría</span>;
  }

  const DEFAULT_METROS_POR_PIXEL = 0.01;
  const mpp = Number(escalaMetrosPorPixel) > 0 ? Number(escalaMetrosPorPixel) : DEFAULT_METROS_POR_PIXEL;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  vectorData.forEach(s => {
    if (s.tipo === 'muro' || s.tipo === 'puerta' || s.tipo === 'ventana' || s.tipo === 'texto' || s.tipo === 'cota' || s.tipo === 'simbolo') {
      const x = s.x || s.x1 || 0;
      const y = s.y || s.y1 || 0;
      const w = s.width || Math.abs((s.x2 || 0) - (s.x1 || 0)) || 0;
      const h = s.height || Math.abs((s.y2 || 0) - (s.y1 || 0)) || 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
  });

  if (minX === Infinity) return <span className="text-xs text-slate-500">Sin geometría renderizable</span>;

  const pad = 80;
  const w = (maxX - minX) + pad * 2;
  const h = (maxY - minY) + pad * 2;
  const vb = `${minX - pad} ${minY - pad} ${w} ${h}`;

  // Utilidad para símbolos
  const symbolPathByName = (nombre) => {
    const key = String(nombre || '').trim().toLowerCase();
    if (key === 'cama') return 'M4 14 H96 V66 H4 Z M4 14 H96 V24 H4 Z M8 28 H44 V48 H8 Z M56 28 H92 V48 H56 Z';
    if (key === 'inodoro' || key === 'wc') return 'M30 4 H70 V20 H30 Z M26 20 C26 16 74 16 74 20 L74 46 C74 60 26 60 26 46 Z';
    if (key === 'auto' || key === 'carro' || key === 'coche') return 'M10 44 H90 V58 H10 Z M25 44 L35 28 H65 L75 44 Z M25 58 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M75 58 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0';
    if (key === 'escalera' || key === 'gradas' || key === 'escaleras') return 'M12 60 H38 V50 H48 V40 H58 V30 H68 V20 H92 V12 H82 V18 H64 V28 H54 V38 H44 V48 H34 V60 H12 Z';
    return null;
  };

  return (
    <svg viewBox={vb} className="w-full h-full" style={{ backgroundColor: '#0f172a' }}>
      {vectorData.map((s, i) => {
        const x = Number(s.x) || 0;
        const y = Number(s.y) || 0;
        const width = Number(s.width) || 0;
        const height = Number(s.height) || 0;
        const rot = Number(s.rotation) || 0;
        const transform = rot ? `rotate(${rot} ${x} ${y})` : undefined;

        if (s.tipo === 'muro' || s.tipo === 'puerta') {
          const isMuro = s.tipo === 'muro';
          const fill = isMuro ? "#94a3b8" : "transparent";
          const rectElt = <rect x={x} y={y} width={width} height={height} fill={fill} transform={transform} />;

          let extras = null;
          if (s.tipo === 'puerta') {
            extras = (
              <g transform={transform}>
                 <line x1={x} y1={y + height/2} x2={x + width} y2={y + height/2} stroke="#CBD5E1" strokeWidth={height} opacity="0.18" />
                 <circle cx={x} cy={y + height/2} r={3.5} fill="#CBD5E1" />
                 <line x1={x} y1={y + height/2} x2={x} y2={y + height/2 - width} stroke="#CBD5E1" strokeWidth={2.5} strokeLinecap="round" />
                 <path d={`M ${x} ${y + height/2 - width} A ${width} ${width} 0 0 1 ${x + width} ${y + height/2}`} fill="rgba(203,213,225,0.10)" stroke="#CBD5E1" strokeWidth={1} />
              </g>
            );
          }

          const lengthPx = Math.max(width, height);
          const isLocalVertical = height > width;
          const valor = (lengthPx * mpp).toFixed(2) + "m";
          
          let textRotAbs = rot;
          if (isLocalVertical) textRotAbs += 90;
          while (textRotAbs > 90) textRotAbs -= 180;
          while (textRotAbs <= -90) textRotAbs += 180;

          const cx = x + width / 2;
          const cy = y + height / 2;
          
          const off = 14;
          const xOff = isLocalVertical ? -(width / 2 + off) : 0;
          const yOff = isLocalVertical ? 0 : -(height / 2 + off);

          const rotRel = textRotAbs - rot; 
          const groupTransform = `translate(${cx} ${cy}) rotate(${rot}) translate(${xOff} ${yOff}) rotate(${rotRel})`;

          return (
            <g key={i}>
              {isMuro && rectElt}
              {extras}
              <g transform={groupTransform}>
                <rect x={-24} y={-10} width={48} height={20} fill="rgba(15,23,42,0.78)" stroke="rgba(56,189,248,0.35)" strokeWidth={1} rx={6} />
                <text x={0} y={4} fill="#93C5FD" fontSize={11} fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">{valor}</text>
              </g>
            </g>
          );
        }

        if (s.tipo === 'ventana') {
          return (
            <g key={i} transform={transform}>
              <rect x={x} y={y} width={width} height={height} fill="transparent" stroke="#7DD3FC" strokeWidth={2} rx={1} />
              <line x1={x} y1={y + height*0.25} x2={x+width} y2={y + height*0.25} stroke="#7DD3FC" strokeWidth={1} />
              <line x1={x} y1={y + height*0.75} x2={x+width} y2={y + height*0.75} stroke="#7DD3FC" strokeWidth={1} />
              <line x1={x+width/2} y1={y} x2={x+width/2} y2={y+height} stroke="#7DD3FC" strokeWidth={1.5} />
            </g>
          )
        }

        if (s.tipo === 'simbolo') {
          const path = symbolPathByName(s.nombre) || 'M10 10 H90 V90 H10 Z';
          const scale = Number(s.escala) || 1;
          const scTransform = `translate(${x} ${y}) rotate(${rot}) scale(${scale})`;
          return (
            <g key={i} transform={scTransform}>
               <path d={path} fill="#1E3A5F" stroke="#38BDF8" strokeWidth={2} />
            </g>
          );
        }

        if (s.tipo === 'texto') {
           return <text key={i} x={x} y={y} transform={transform} fill="#cbd5e1" fontSize={s.tamano_fuente || 16} fontFamily="sans-serif" fontWeight="bold">{s.texto}</text>
        }

        if (s.tipo === 'cota') {
           return (
            <g key={i}>
              <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#f59e0b" strokeWidth={2} opacity="0.7" />
              <text x={(s.x1 + s.x2)/2} y={(s.y1 + s.y2)/2 - 5} fill="#f59e0b" fontSize={14} fontWeight="bold" textAnchor="middle">{s.valor}</text>
            </g>
          )
        }
        return null;
      })}
    </svg>
  );
}

export function AlternativasModal({ open, onClose, planoOriginal, costoActual, onAplicar }) {
  const [loading, setLoading] = useState(false)
  const [alternativas, setAlternativas] = useState([])
  const [error, setError] = useState('')
  const [opciones, setOpciones] = useState({
    enfoque: 'balanceado', // balanceado, economico, rapido, sostenible
    cantidad: 3 // 1, 2, 3
  })

  const handleGenerar = async () => {
    if (!planoOriginal?.id) return
    setLoading(true)
    setError('')
    try {
      const result = await generarAlternativas(planoOriginal.id, { ...opciones, costo_actual: costoActual })
      setAlternativas(Array.isArray(result) ? result : [])
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Error generando alternativas')
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (val) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(val || 0)

  if (alternativas.length > 0) {
    return (
      <Modal open={open} onClose={onClose} title="Diseños Alternativos Generados" maxWidthClass="max-w-6xl">
        <div className={`grid gap-6 ${alternativas.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : alternativas.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto' : 'grid-cols-1 md:grid-cols-3'}`}>
          {alternativas.map((alt, i) => (
            <div key={alt.id} className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden flex flex-col">
              <div className="h-48 bg-slate-800 border-b border-slate-700 flex items-center justify-center relative overflow-hidden">
                 <MiniPlanoSVG vectorData={alt.datos_vectoriales} escalaMetrosPorPixel={alt.escala_metros_por_pixel || planoOriginal?.escala_metros_por_pixel} />
                 <div className="absolute top-2 right-2 bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-500/30">
                    Alternativa {i+1}
                 </div>
              </div>
              <div className="p-4 flex-1 space-y-3">
                <div>
                  <p className="text-xs text-slate-400">Costo Estimado</p>
                  <p className="font-semibold text-emerald-400">{formatMoney(alt.costo_estimado)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-slate-400">Tiempo</p>
                    <p className="font-medium text-slate-200">{alt.tiempo_estimado_dias} días</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Sostenibilidad</p>
                    <p className="font-medium text-sky-400">{alt.puntuacion_sostenibilidad}/100</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Huella CO₂</p>
                  <p className="font-medium text-amber-400/80">{alt.co2_estimado} kg</p>
                </div>
              </div>
              <div className="p-3 border-t border-slate-700 bg-slate-800/50">
                <Button className="w-full text-xs py-1.5" onClick={() => onAplicar(alt)}>
                  Aplicar esta versión
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Generar Alternativas con IA" maxWidthClass="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          Usa Inteligencia Artificial para generar versiones alternativas del plano original.
          Se optimizarán muros no estructurales, redistribución de espacios, y materiales.
        </p>

        {error && (
           <div className="p-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">
             {error}
           </div>
        )}

        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Enfoque de optimización</label>
          <select 
            value={opciones.enfoque}
            onChange={e => setOpciones({...opciones, enfoque: e.target.value})}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200"
          >
            <option value="balanceado">Balanceado</option>
            <option value="economico">Priorizar Costo (Económico)</option>
            <option value="rapido">Priorizar Tiempo de Obra</option>
            <option value="sostenible">Priorizar Sostenibilidad (Bajo CO₂)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Cantidad a generar</label>
          <div className="flex bg-slate-900 border border-slate-700 rounded-xl overflow-hidden p-1">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setOpciones({...opciones, cantidad: num})}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${opciones.cantidad === num ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              >
                {num} {num === 1 ? 'Opción' : 'Opciones'}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleGenerar} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500">
            {loading ? 'Procesando con IA...' : `Generar ${opciones.cantidad} Alternativa${opciones.cantidad > 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
