/* ─────────────────────────────────────────────
   Input — Campo de texto reutilizable
   Diseño oscuro con borde brillante al focus
   ───────────────────────────────────────────── */

export function Input({ label, className = '', error, ...props }) {
  return (
    <label className="block">
      {/* Etiqueta superior */}
      {label && (
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
      )}

      {/* Campo de entrada */}
      <input
        className={[
          'w-full h-11 rounded-xl px-4',
          /* Fondo semitransparente oscuro */
          'bg-white/5 text-white',
          /* Borde tenue que resalta al focus */
          'border border-white/10',
          'outline-none transition-all duration-200',
          'focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/25',
          /* Placeholder gris suave */
          'placeholder:text-slate-500',
          /* Error visual */
          error ? 'border-rose-500/60 focus:ring-rose-500/25' : '',
          className,
        ].join(' ')}
        {...props}
      />

      {/* Mensaje de error */}
      {error && (
        <span className="mt-1.5 block text-xs text-rose-400">{error}</span>
      )}
    </label>
  )
}
