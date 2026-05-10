import { useToast } from '../hooks/useToast.jsx'

function SuccessIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.5 12.75l4.5 4.5L19.5 6.75" />
    </svg>
  )
}

function WarningIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 9v4.5m0 3h.008v-.008H12v.008zm8.25-.75c0 1.243-1.007 2.25-2.25 2.25H5.999c-1.243 0-2.25-1.007-2.25-2.25 0-.398.105-.79.304-1.136L10.054 4.364a2.25 2.25 0 013.892 0l5.999 10.25c.199.345.304.738.304 1.136z"
      />
    </svg>
  )
}

function ErrorIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9.75 9.75L14.25 14.25M14.25 9.75L9.75 14.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

const TYPE_STYLE = {
  success: {
    icon: SuccessIcon,
    className: 'border-emerald-300/70 bg-emerald-50 text-emerald-900',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  warning: {
    icon: WarningIcon,
    className: 'border-amber-300/70 bg-amber-50 text-amber-900',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  error: {
    icon: ErrorIcon,
    className: 'border-rose-300/70 bg-rose-50 text-rose-900',
    badgeClass: 'bg-rose-100 text-rose-700',
  },
}

export function ToastViewport() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(92vw,420px)] flex-col gap-2">
      {toasts.map((toast) => {
        const style = TYPE_STYLE[toast.type] ?? TYPE_STYLE.success
        const Icon = style.icon
        return (
          <div
            key={toast.id}
            className={[
              'pointer-events-auto rounded-xl border px-3 py-3 shadow-lg backdrop-blur',
              'animate-[toast-in_160ms_ease-out]',
              style.className,
            ].join(' ')}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <span className={["mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full", style.badgeClass].join(' ')}>
                <Icon className="h-4 w-4" />
              </span>

              <div className="flex-1">
                <div className="text-sm font-semibold leading-5">{toast.title}</div>
                {toast.message ? <div className="mt-0.5 text-xs leading-5 opacity-90">{toast.message}</div> : null}
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded-md px-2 py-1 text-xs font-medium opacity-80 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-black/20"
                aria-label="Cerrar notificacion"
              >
                Cerrar
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
