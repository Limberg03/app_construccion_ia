
// ElementsPalette.jsx
// Panel flotante de elementos — drag-and-drop hacia el canvas
// El usuario arrastra un chip y lo suelta sobre el Stage para insertar.

function IconWall(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <rect x="2" y="4" width="20" height="4" rx="1" strokeWidth="1.5" />
      <rect x="2" y="10" width="20" height="4" rx="1" strokeWidth="1.5" />
      <rect x="2" y="16" width="20" height="4" rx="1" strokeWidth="1.5" />
    </svg>
  )
}

function IconDoor(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7.5 3.75h9A1.5 1.5 0 0118 5.25v15H7.5v-16.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}
        d="M15.25 12h.01" />
    </svg>
  )
}

function IconWindow(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4.5 6.75h15v10.5h-15V6.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 6.75v10.5M4.5 12h15" />
    </svg>
  )
}

function IconText(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 6h16M4 12h10M4 18h7" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M17 10l2 2-2 2m3-2h-5" />
    </svg>
  )
}

function IconDimension(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 12h18M3 8v8M21 8v8" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M8 7l-2 5 2 5M16 7l2 5-2 5" />
    </svg>
  )
}

function IconBed(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <rect x="2" y="8" width="20" height="12" rx="2" strokeWidth="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M2 14h20M7 11a2 2 0 100-4 2 2 0 000 4zM17 11a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
  )
}

function IconToilet(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <rect x="7" y="2" width="10" height="5" rx="1" strokeWidth="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M5 7h14v2a7 7 0 01-14 0V7z" />
    </svg>
  )
}

function IconCar(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 14v-2.5l2-4A2 2 0 017 6h10a2 2 0 011.8 1.1l2.2 4.4V14"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 14h14" />
      <circle cx="7" cy="16.5" r="1.5" strokeWidth="1.5" />
      <circle cx="17" cy="16.5" r="1.5" strokeWidth="1.5" />
    </svg>
  )
}

function IconStairs(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 18h6v-4h4v-4h6"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 18v-2h4v2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14v-2h4v2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10V8h6v2" />
    </svg>
  )
}

// ─── Definición de todos los elementos del pallete ──────────────────────────
// tipo: qué función del hook se invocará
// payload: datos extra que se pasan junto con la posición de drop
const PALETTE_GROUPS = [
  {
    label: 'Estructura',
    color: 'from-slate-700 to-slate-800',
    accent: '#38BDF8',
    items: [
      {
        tipo: 'muro',
        label: 'Muro',
        Icon: IconWall,
        payload: {},
        hint: 'Arrastra para colocar un muro',
      },
      {
        tipo: 'puerta',
        label: 'Puerta',
        Icon: IconDoor,
        payload: {},
        hint: 'Arrastra para colocar una puerta',
      },
      {
        tipo: 'ventana',
        label: 'Ventana',
        Icon: IconWindow,
        payload: {},
        hint: 'Arrastra para colocar una ventana',
      },
    ],
  },
  {
    label: 'Anotaciones',
    color: 'from-violet-900 to-slate-800',
    accent: '#A78BFA',
    items: [
      {
        tipo: 'texto',
        label: 'Texto',
        Icon: IconText,
        payload: { texto: 'Etiqueta', tamano_fuente: 16 },
        hint: 'Arrastra para colocar texto libre',
      },
      {
        tipo: 'cota',
        label: 'Cota',
        Icon: IconDimension,
        payload: { valor: '1 m', orientacion: 'horizontal' },
        hint: 'Arrastra para colocar una cota',
      },
    ],
  },
  {
    label: 'Mobiliario',
    color: 'from-emerald-900 to-slate-800',
    accent: '#34D399',
    items: [
      {
        tipo: 'simbolo',
        label: 'Cama',
        Icon: IconBed,
        payload: { nombre: 'cama', categoria: 'mueble', rotacion: 0, escala: 1 },
        hint: 'Arrastra para colocar una cama',
      },
      {
        tipo: 'simbolo',
        label: 'Inodoro',
        Icon: IconToilet,
        payload: { nombre: 'inodoro', categoria: 'sanitario', rotacion: 0, escala: 1 },
        hint: 'Arrastra para colocar un inodoro',
      },
      {
        tipo: 'simbolo',
        label: 'Auto',
        Icon: IconCar,
        payload: { nombre: 'auto', categoria: 'vehiculo', rotacion: 0, escala: 1 },
        hint: 'Arrastra para colocar un auto',
      },
      {
        tipo: 'simbolo',
        label: 'Escalera',
        Icon: IconStairs,
        payload: { nombre: 'escalera', categoria: 'circulacion', rotacion: 0, escala: 1 },
        hint: 'Arrastra para colocar una escalera / gradas',
      },
    ],
  },
]

function PaletteChip({ item, onDragStart }) {
  const { Icon, label, tipo, payload, hint } = item

  return (
    <div
      draggable
      title={hint}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy'
        e.dataTransfer.setData('application/x-plano-element', JSON.stringify({ tipo, payload }))
        onDragStart?.()
      }}
      className="
        group flex flex-col items-center gap-1.5 cursor-grab active:cursor-grabbing
        rounded-xl border border-slate-700/60 bg-slate-800/80 p-3
        hover:border-sky-500/60 hover:bg-slate-700/90
        transition-all duration-150 select-none
        hover:scale-105 active:scale-95
      "
    >
      <Icon className="w-6 h-6 text-slate-300 group-hover:text-sky-300 transition-colors" />
      <span className="text-[10px] font-medium text-slate-400 group-hover:text-sky-300 leading-none transition-colors">
        {label}
      </span>
    </div>
  )
}

export function ElementsPalette({ isDark }) {
  return (
    <div
      className="
        flex flex-col gap-3 rounded-2xl
        border border-slate-700/70 bg-slate-950/95 backdrop-blur
        px-3 py-4 w-[108px] shadow-2xl
        max-h-[calc(100vh-120px)] overflow-y-auto
        scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent
      "
      style={{ scrollbarWidth: 'thin' }}
    >
      {/* Header */}
      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 text-center px-1">
        Elementos
      </div>

      {PALETTE_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1.5">
          {/* Group label */}
          <div className="text-[8px] font-semibold uppercase tracking-widest text-slate-600 text-center">
            {group.label}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {group.items.map((item) => (
              <PaletteChip key={`${item.tipo}-${item.label}`} item={item} />
            ))}
          </div>
          <div className="h-px bg-slate-800/80 mt-0.5" />
        </div>
      ))}

      {/* Hint */}
      <div className="text-[8px] text-slate-600 text-center leading-relaxed px-1">
        Arrastra al canvas para insertar
      </div>
    </div>
  )
}

