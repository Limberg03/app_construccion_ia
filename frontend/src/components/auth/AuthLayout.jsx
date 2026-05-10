/* ─────────────────────────────────────────────
   AuthLayout — Layout de autenticación futurista
   Panel izquierdo: plano 3D + branding
   Panel derecho: formulario con glassmorphism
   ───────────────────────────────────────────── */

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    /* Fondo tipo blueprint arquitectónico */
    <div className="relative min-h-screen overflow-hidden blueprint-grid">

      {/* ── Decoraciones de fondo animadas ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Círculo de brillo superior-izquierdo */}
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        {/* Círculo ámbar inferior-derecho */}
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
        {/* Línea diagonal decorativa */}
        <div
          className="absolute left-0 top-0 h-px w-full opacity-20"
          style={{
            background:
              'linear-gradient(90deg, transparent, #0ea5e9 40%, transparent)',
          }}
        />
      </div>

      {/* ── Contenedor principal centrado ── */}
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-8">
        <div
          className="grid w-full overflow-hidden rounded-3xl shadow-2xl shadow-sky-900/40 lg:grid-cols-2"
          style={{ border: '1px solid rgba(14,165,233,0.2)' }}
        >
          {/* ════ PANEL IZQUIERDO: Visualización 3D ════ */}
          <section className="relative hidden flex-col justify-between overflow-hidden bg-[#040c1a] p-10 text-white lg:flex">

            {/* Cuadrícula interior extra fina */}
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(14,165,233,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.1) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />

            {/* Objeto 3D: plano isométrico flotante */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <BlueprintScene />
            </div>

            {/* Branding superior */}
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-sky-300">
                {/* Icono IA */}
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
                Gestión de Construcción IA
              </span>

              <h1 className="mt-6 text-3xl font-bold leading-tight">
                De{' '}
                <span className="text-gradient-primary">Plano</span>
                {' '}a{' '}
                <span className="text-gradient-accent">Presupuesto</span>
              </h1>

              <p className="mt-4 max-w-xs text-sm leading-7 text-slate-400">
                Digitaliza tus proyectos de construcción. Organiza materiales,
                controla costos y genera presupuestos con apoyo de IA.
              </p>
            </div>

            {/* Chips de características inferiores */}
            <div className="relative z-10 flex flex-wrap gap-2">
              {['Scraping en vivo', 'Precios actualizados', 'JWT seguro', 'Multi-proyecto'].map(
                (tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400"
                  >
                    {tag}
                  </span>
                )
              )}
            </div>
          </section>

          {/* ════ PANEL DERECHO: Formulario ════ */}
          <section className="flex flex-col justify-center bg-[#090e1d] p-8 sm:p-12">
            {/* Logo móvil (solo visible sin panel izquierdo) */}
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <div className="h-6 w-6 rounded bg-sky-500" />
              <span className="text-sm font-semibold text-white">De Plano a Presupuesto</span>
            </div>

            {/* Título del formulario */}
            <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>

            {/* Formulario hijo (login / registro) */}
            <div className="mt-8">{children}</div>

            {/* Enlace de navegación entre login/registro */}
            {footer && (
              <div className="mt-6 text-sm text-slate-500">{footer}</div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   BlueprintScene — Escena SVG isométrica 3D
   Simula planos y estructura de edificio
   ───────────────────────────────────────────── */
function BlueprintScene() {
  return (
    <svg
      viewBox="0 0 400 420"
      className="h-[380px] w-[380px] animate-float opacity-90"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Degradado azul para superficies */}
        <linearGradient id="faceTop" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="faceLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0369a1" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#082f49" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="faceRight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0284c7" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0c4a6e" stopOpacity="0.8" />
        </linearGradient>

        {/* Brillo ámbar para detalles */}
        <linearGradient id="accentGlow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0.3" />
        </linearGradient>

        {/* Filtro blur para sombra */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* ── Plataforma base ── */}
      <g opacity="0.6">
        <polygon points="200,320 340,270 340,290 200,340 60,290 60,270" fill="#0a1628" stroke="#0ea5e9" strokeWidth="0.5" />
        <polygon points="200,320 340,270 200,220 60,270" fill="url(#faceTop)" stroke="#0ea5e9" strokeWidth="0.7" />
      </g>

      {/* ── Edificio principal (cubo isométrico) ── */}
      {/* Cara superior */}
      <polygon
        points="200,120 300,170 200,220 100,170"
        fill="url(#faceTop)"
        stroke="#38bdf8"
        strokeWidth="1"
      />
      {/* Cara izquierda */}
      <polygon
        points="100,170 200,220 200,300 100,250"
        fill="url(#faceLeft)"
        stroke="#0ea5e9"
        strokeWidth="1"
      />
      {/* Cara derecha */}
      <polygon
        points="300,170 200,220 200,300 300,250"
        fill="url(#faceRight)"
        stroke="#0ea5e9"
        strokeWidth="1"
      />

      {/* ── Ventanas cara izquierda ── */}
      {[0, 1].map((row) =>
        [0, 1].map((col) => (
          <rect
            key={`wl-${row}-${col}`}
            x={118 + col * 30}
            y={195 + row * 28}
            width="18"
            height="16"
            rx="2"
            fill="#0ea5e9"
            opacity="0.35"
            stroke="#38bdf8"
            strokeWidth="0.5"
          />
        ))
      )}

      {/* ── Ventanas cara derecha ── */}
      {[0, 1].map((row) =>
        [0, 1].map((col) => (
          <rect
            key={`wr-${row}-${col}`}
            x={222 + col * 30}
            y={195 + row * 28}
            width="18"
            height="16"
            rx="2"
            fill="#0ea5e9"
            opacity="0.25"
            stroke="#38bdf8"
            strokeWidth="0.5"
          />
        ))
      )}

      {/* ── Techo con brillo ámbar ── */}
      <line x1="200" y1="120" x2="200" y2="60" stroke="#f59e0b" strokeWidth="1.5" opacity="0.7" />
      <polygon
        points="200,60 240,90 200,120 160,90"
        fill="url(#accentGlow)"
        stroke="#f59e0b"
        strokeWidth="0.8"
        opacity="0.6"
      />

      {/* ── Torre secundaria (izquierda) ── */}
      <polygon points="110,165 150,188 120,205 80,182" fill="url(#faceTop)" stroke="#38bdf8" strokeWidth="0.7" opacity="0.7" />
      <polygon points="80,182 120,205 120,255 80,232" fill="url(#faceLeft)" stroke="#0ea5e9" strokeWidth="0.7" opacity="0.7" />
      <polygon points="150,188 120,205 120,255 150,232" fill="url(#faceRight)" stroke="#0ea5e9" strokeWidth="0.7" opacity="0.7" />

      {/* ── Grúa de construcción ── */}
      {/* Columna grúa */}
      <line x1="330" y1="100" x2="330" y2="260" stroke="#f59e0b" strokeWidth="2.5" opacity="0.7" />
      {/* Brazo horizontal grúa */}
      <line x1="270" y1="100" x2="370" y2="100" stroke="#f59e0b" strokeWidth="2" opacity="0.7" />
      {/* Cable con gancho */}
      <line x1="290" y1="100" x2="290" y2="155" stroke="#94a3b8" strokeWidth="1" opacity="0.6" />
      <rect x="283" y="155" width="14" height="10" rx="2" fill="none" stroke="#f59e0b" strokeWidth="1.2" opacity="0.7" />
      {/* Contrapeso grúa */}
      <rect x="348" y="95" width="22" height="12" rx="2" fill="#f59e0b" opacity="0.5" />

      {/* ── Dimensiones de plano (líneas cotas) ── */}
      <g opacity="0.4" stroke="#38bdf8" strokeWidth="0.6">
        <line x1="60" y1="310" x2="340" y2="310" />
        <line x1="60" y1="306" x2="60" y2="314" />
        <line x1="340" y1="306" x2="340" y2="314" />
      </g>
      <text x="200" y="325" textAnchor="middle" fontSize="8" fill="#38bdf8" opacity="0.5" fontFamily="monospace">
        24.00 m
      </text>

      {/* ── Puntos de referencia (nodos) ── */}
      {[[200,120],[300,170],[100,170],[200,220]].map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3.5" fill="#0ea5e9" opacity="0.8" />
      ))}

      {/* ── Texto "PLANO A-01" ── */}
      <text x="100" y="90" fontSize="9" fill="#0ea5e9" opacity="0.5" fontFamily="monospace" letterSpacing="2">
        PLANO A-01 • EDIFICIO PRINCIPAL
      </text>
      <line x1="100" y1="94" x2="300" y2="94" stroke="#0ea5e9" strokeWidth="0.4" opacity="0.3" />
    </svg>
  )
}
