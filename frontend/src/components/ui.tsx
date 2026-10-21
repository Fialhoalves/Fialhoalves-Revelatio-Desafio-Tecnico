import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-400',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  )
}

export const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-2 focus:outline-indigo-500/30 disabled:bg-slate-100'

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-600">
          {error}
        </span>
      )}
    </label>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={`inline-block size-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 ${className}`}
    />
  )
}

const TONES = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  indigo: 'bg-indigo-100 text-indigo-700',
}

export function Badge({ tone = 'slate', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info'; children: ReactNode }) {
  const style = tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${style}`}>
      {children}
    </div>
  )
}

const openModals: symbol[] = []

export function Modal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'md' | 'lg'
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    // Mantém o foco do campo com autoFocus; só foca o painel quando nada dentro dele já o tem.
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus()
    const token = Symbol('modal')
    openModals.push(token)
    const onKey = (event: KeyboardEvent) => {
      // Com diálogos empilhados, o Escape fecha apenas o do topo.
      if (event.key === 'Escape' && openModals[openModals.length - 1] === token) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      openModals.splice(openModals.indexOf(token), 1)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl ${size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy && <Spinner className="size-4 border-white/40 border-t-white" />}
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
