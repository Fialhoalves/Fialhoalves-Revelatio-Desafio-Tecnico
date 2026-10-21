import { Children, useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { ScrambleText } from './ScrambleText'

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-white text-black hover:bg-white/80 disabled:bg-white/30',
  secondary: 'bg-white/16 text-white backdrop-blur hover:bg-white/25 disabled:text-white/40 disabled:hover:bg-white/16',
  outline: 'border border-white/60 text-white hover:bg-white/10 disabled:border-white/20 disabled:text-white/40',
  danger: 'bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:text-red-300/40 disabled:hover:bg-red-500/15',
  ghost: 'text-white/70 hover:bg-white/10 hover:text-white disabled:text-white/30 disabled:hover:bg-transparent',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-[0.333em] px-3.5 py-2 text-[13px] transition-colors duration-[350ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {Children.map(children, (child) => (typeof child === 'string' ? <ScrambleText text={child} /> : child))}
    </button>
  )
}

export const inputClass =
  'block w-full rounded-[0.333em] border border-white/16 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 transition-colors duration-[350ms] focus:border-white/70 focus:outline-none disabled:opacity-50'

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/60">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-white/50">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-300">
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
      className={`inline-block size-5 animate-spin rounded-full border-2 border-current/25 border-t-current ${className}`}
    />
  )
}

// A cor identifica o estado; o formato (chip fino, quase quadrado) segue o resto da interface.
const TONES = {
  slate: 'border-white/16 text-white/70',
  blue: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  red: 'border-red-400/30 bg-red-400/10 text-red-300',
  indigo: 'border-white/30 bg-white/10 text-white',
}

export function Badge({ tone = 'slate', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-[3px] border px-2 py-0.5 text-[11px] ${TONES[tone]}`}>{children}</span>
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info'; children: ReactNode }) {
  const style = tone === 'error' ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-white/16 bg-white/8 text-white/80'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-[0.333em] border px-3 py-2 text-sm ${style}`}>
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
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
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
        className={`max-h-[92vh] w-full animate-rise overflow-y-auto rounded-t-lg border border-white/16 bg-[#0b0b0b] outline-none sm:rounded-lg ${size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/12 bg-[#0b0b0b] px-5 py-3">
          <h2 className="text-lg tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-[0.333em] p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
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
      <p className="text-sm text-white/60">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy && <Spinner className="size-4" />}
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
