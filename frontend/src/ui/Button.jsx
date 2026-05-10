/* ─────────────────────────────────────────────
   Button — Botón reutilizable con variantes
   Tema futurista: gradiente, glow, glassmorphism
   ───────────────────────────────────────────── */

/* Variantes de estilo por nombre */
const VARIANT = {
  /* Botón principal — gradiente azul con brillo */
  primary:
    'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500 hover:shadow-sky-400/40 focus-visible:ring-sky-400',

  /* Botón secundario — borde sutil oscuro */
  secondary:
    'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20 focus-visible:ring-slate-500',

  /* Botón de peligro — rojo fuerte */
  danger:
    'bg-gradient-to-r from-rose-600 to-red-700 text-white shadow shadow-rose-500/20 hover:from-rose-500 hover:to-red-600 focus-visible:ring-rose-400',

  /* Botón de barra de herramientas */
  toolbar:
    'bg-slate-800 text-white border border-slate-700 hover:bg-slate-700',

  /* Peligro en toolbar */
  toolbarDanger:
    'bg-rose-700 text-white border border-rose-800 hover:bg-rose-600',
}

/* Tamaños de botón */
const SIZE = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={[
        /* Base */
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
        /* Transición suave */
        'transition-all duration-200 ease-out',
        /* Estado deshabilitado */
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
        /* Focus accesible */
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090e1d]',
        SIZE[size] ?? SIZE.md,
        VARIANT[variant] ?? VARIANT.primary,
        className,
      ].join(' ')}
      {...props}
    />
  )
}
