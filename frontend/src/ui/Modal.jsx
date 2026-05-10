/* ─────────────────────────────────────────────
   Modal — Diálogo emergente reutilizable
   Tema oscuro con glassmorphism sutil
   ───────────────────────────────────────────── */

import { Button } from './Button'

export function Modal({ open, title, children, onClose, footer, maxWidthClass = 'max-w-lg', panelClassName = '' }) {
  /* No renderiza nada si está cerrado */
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fondo oscuro semitransparente */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Cuerpo del modal */}
      <div className={[
        'relative w-full rounded-2xl border border-white/10 bg-[#0d1526] shadow-2xl shadow-black/50',
        maxWidthClass,
        panelClassName,
      ].join(' ')}>

        {/* Encabezado con título y botón cerrar */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        {/* Contenido hijo */}
        <div className="p-5">{children}</div>

        {/* Footer con acciones */}
        {footer && (
          <div className="border-t border-white/8 px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}
