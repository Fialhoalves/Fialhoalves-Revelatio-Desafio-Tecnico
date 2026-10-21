import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { formatDate, isOverdue, PRIORITY_LABEL, STATUS_LABEL } from '../lib/format'
import { PRIORITY_TONE, STATUS_ORDER } from '../lib/tones'
import type { Task, TaskStatus } from '../types'
import { Badge } from './ui'

const DOT: Record<TaskStatus, string> = {
  PENDING: 'bg-amber-300',
  IN_PROGRESS: 'bg-sky-300',
  DONE: 'bg-emerald-300',
}

const MOVE_THRESHOLD = 6
const SCROLL_EDGE = 90

const compactSelect =
  'block w-full rounded-[0.333em] border border-white/16 bg-white/5 px-2 py-1.5 text-base text-white transition-colors duration-[350ms] focus:border-white/70 focus:outline-none disabled:opacity-50 md:py-1 md:text-xs'

interface Props {
  tasks: Task[]
  /** Colunas exibidas; com filtro de status ativo, apenas a coluna filtrada. */
  statuses: TaskStatus[]
  showOwner: boolean
  onMove: (task: Task, status: TaskStatus) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

interface PendingDrag {
  task: Task
  card: HTMLElement
  pointerId: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  width: number
  started: boolean
}

interface Floating {
  task: Task
  x: number
  y: number
  width: number
  over: TaskStatus | null
}

interface Returning {
  task: Task
  x: number
  y: number
  toX: number
  toY: number
  width: number
  settling: boolean
}

/**
 * Quadro por status. O arrastar usa Pointer Events (mouse, toque e caneta) em vez do arrastar nativo
 * do navegador, que não funciona com toque. No celular o arrasto começa pela alça do cartão, para não
 * bloquear a rolagem da página; o seletor de status de cada cartão continua como alternativa.
 */
export function KanbanBoard({ tasks, statuses, showOwner, onMove, onEdit, onDelete }: Props) {
  const columnRefs = useRef(new Map<TaskStatus, HTMLElement>())
  const pending = useRef<PendingDrag | null>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const ghostPosition = useRef({ x: 0, y: 0 })
  const suppressClick = useRef(false)
  const frame = useRef<number | null>(null)
  const onMoveRef = useRef(onMove)

  const [floating, setFloating] = useState<Floating | null>(null)
  const [returning, setReturning] = useState<Returning | null>(null)
  const [landedId, setLandedId] = useState<number | null>(null)

  useEffect(() => {
    onMoveRef.current = onMove
  })

  useEffect(() => {
    const columnAt = (x: number, y: number): TaskStatus | null => {
      for (const [status, element] of columnRefs.current) {
        const rect = element.getBoundingClientRect()
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return status
      }
      return null
    }

    // Rola a página quando o cartão chega perto da borda, para alcançar colunas fora da tela.
    const tick = () => {
      const current = pending.current
      if (!current?.started) {
        frame.current = null
        return
      }
      const { x, y } = pointer.current
      const bottomEdge = window.innerHeight - SCROLL_EDGE
      const delta = y < SCROLL_EDGE ? -Math.ceil((SCROLL_EDGE - y) / 6) : y > bottomEdge ? Math.ceil((y - bottomEdge) / 6) : 0
      if (delta !== 0) {
        window.scrollBy(0, delta)
        const over = columnAt(x, y)
        setFloating((value) => (value && value.over !== over ? { ...value, over } : value))
      }
      frame.current = requestAnimationFrame(tick)
    }

    const onPointerMove = (event: PointerEvent) => {
      const current = pending.current
      if (!current || event.pointerId !== current.pointerId) return
      pointer.current = { x: event.clientX, y: event.clientY }

      if (!current.started) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < MOVE_THRESHOLD) return
        current.started = true
        suppressClick.current = true
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
        frame.current = requestAnimationFrame(tick)
      }

      ghostPosition.current = { x: event.clientX - current.offsetX, y: event.clientY - current.offsetY }
      setFloating({
        task: current.task,
        ...ghostPosition.current,
        width: current.width,
        over: columnAt(event.clientX, event.clientY),
      })
    }

    const onPointerEnd = (event: PointerEvent) => {
      const current = pending.current
      if (!current || event.pointerId !== current.pointerId) return
      pending.current = null
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (!current.started) return

      // O clique que se segue ao arrasto não deve abrir a edição.
      setTimeout(() => {
        suppressClick.current = false
      }, 0)

      const target = event.type === 'pointerup' ? columnAt(event.clientX, event.clientY) : null
      setFloating(null)

      if (target && target !== current.task.status) {
        setLandedId(current.task.id)
        setTimeout(() => setLandedId(null), 700)
        onMoveRef.current(current.task, target)
        return
      }

      // Soltou fora de uma coluna ou na mesma: o cartão volta suavemente ao lugar de origem.
      const origin = current.card.getBoundingClientRect()
      const { x, y } = ghostPosition.current
      setReturning({ task: current.task, x, y, toX: origin.left, toY: origin.top, width: current.width, settling: false })
      requestAnimationFrame(() => requestAnimationFrame(() => setReturning((value) => value && { ...value, settling: true })))
      setTimeout(() => setReturning(null), 320)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onPointerEnd)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerEnd)
      window.removeEventListener('pointercancel', onPointerEnd)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const beginDrag = (task: Task, event: ReactPointerEvent<HTMLElement>, card: HTMLElement, fromHandle: boolean) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // Com o dedo, só a alça arrasta; o resto do cartão continua rolando a página.
    if (event.pointerType !== 'mouse' && !fromHandle) return
    if (!fromHandle && (event.target as HTMLElement).closest('select,[data-nodrag]')) return

    const rect = card.getBoundingClientRect()
    pointer.current = { x: event.clientX, y: event.clientY }
    pending.current = {
      task,
      card,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      started: false,
    }
  }

  const dragged = floating?.task.id ?? returning?.task.id ?? null

  return (
    <>
      <div className={`grid gap-3 ${statuses.length > 1 ? 'md:grid-cols-3' : ''}`}>
        {statuses.map((status) => {
          const column = tasks.filter((task) => task.status === status)
          const active = floating?.over === status && floating.task.status !== status
          return (
            <section
              key={status}
              ref={(element) => {
                if (element) columnRefs.current.set(status, element)
                else columnRefs.current.delete(status)
              }}
              aria-label={`Coluna ${STATUS_LABEL[status]}`}
              className={`min-h-48 rounded-md border p-3 transition-colors duration-[350ms] ${
                active ? 'border-white/60 bg-white/10' : 'border-white/12 bg-white/4'
              }`}
            >
              <header className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm">
                  <span aria-hidden="true" className={`size-2 rounded-full ${DOT[status]}`} />
                  {STATUS_LABEL[status]}
                </h3>
                <span className="text-xs text-white/60">{column.length}</span>
              </header>

              <div className="space-y-2">
                {column.map((task) => (
                  <BoardCard
                    key={task.id}
                    task={task}
                    showOwner={showOwner}
                    placeholder={dragged === task.id}
                    landed={landedId === task.id}
                    onPointerDown={(event, card, fromHandle) => beginDrag(task, event, card, fromHandle)}
                    shouldSuppressClick={() => suppressClick.current}
                    onMove={onMove}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
                {active && <div className="h-16 animate-settle rounded-md border border-dashed border-white/50 bg-white/5" />}
                {column.length === 0 && !active && (
                  <p className="rounded-md border border-dashed border-white/12 px-3 py-6 text-center text-xs text-white/40">
                    {floating ? 'Solte aqui' : 'Nenhuma tarefa'}
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {floating &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: floating.width,
              transform: `translate3d(${floating.x}px, ${floating.y}px, 0)`,
              zIndex: 60,
              pointerEvents: 'none',
            }}
          >
            <div className="animate-lift rounded-md shadow-2xl shadow-black">
              <CardContent task={floating.task} showOwner={showOwner} />
            </div>
          </div>,
          document.body,
        )}

      {returning &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: returning.width,
              transform: `translate3d(${returning.settling ? returning.toX : returning.x}px, ${returning.settling ? returning.toY : returning.y}px, 0)`,
              transition: returning.settling ? 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
              zIndex: 60,
              pointerEvents: 'none',
            }}
          >
            <div
              className="rounded-md"
              style={{
                transform: returning.settling ? 'none' : 'rotate(2deg) scale(1.03)',
                transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <CardContent task={returning.task} showOwner={showOwner} />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

interface CardProps {
  task: Task
  showOwner: boolean
  placeholder: boolean
  landed: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, card: HTMLElement, fromHandle: boolean) => void
  shouldSuppressClick: () => boolean
  onMove: (task: Task, status: TaskStatus) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

function BoardCard({ task, showOwner, placeholder, landed, onPointerDown, shouldSuppressClick, onMove, onEdit, onDelete }: CardProps) {
  return (
    <article
      onPointerDown={(event) => onPointerDown(event, event.currentTarget, false)}
      onDragStart={(event) => event.preventDefault()}
      className={`select-none rounded-md border bg-[#101010] transition-[opacity,border-color] duration-[250ms] md:cursor-grab ${
        placeholder ? 'border-dashed border-white/30 opacity-30' : landed ? 'animate-settle border-white/60' : 'border-white/12 hover:border-white/24'
      }`}
    >
      <CardContent
        task={task}
        showOwner={showOwner}
        interactive
        onHandlePointerDown={(event) => {
          event.stopPropagation()
          const card = event.currentTarget.closest('article') as HTMLElement
          onPointerDown(event, card, true)
        }}
        shouldSuppressClick={shouldSuppressClick}
        onMove={onMove}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </article>
  )
}

interface ContentProps {
  task: Task
  showOwner: boolean
  interactive?: boolean
  onHandlePointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  shouldSuppressClick?: () => boolean
  onMove?: (task: Task, status: TaskStatus) => void
  onEdit?: (task: Task) => void
  onDelete?: (task: Task) => void
}

/** Conteúdo do cartão, compartilhado entre o cartão da coluna e o cartão flutuante durante o arrasto. */
function CardContent({ task, showOwner, interactive = false, onHandlePointerDown, shouldSuppressClick, onMove, onEdit, onDelete }: ContentProps) {
  const overdue = isOverdue(task.due_date, task.status)

  return (
    <div className={`rounded-md border border-white/12 bg-[#101010] p-3 ${interactive ? 'border-transparent' : 'border-white/40'}`}>
      <div className="flex items-start gap-2">
        {interactive ? (
          <button
            type="button"
            onClick={() => {
              if (!shouldSuppressClick?.()) onEdit?.(task)
            }}
            className={`flex min-h-9 min-w-0 flex-1 items-center text-left text-sm leading-snug hover:underline md:min-h-0 md:items-start ${task.status === 'DONE' ? 'text-white/40 line-through' : ''}`}
          >
            {task.title}
          </button>
        ) : (
          <span className="min-w-0 flex-1 text-sm leading-snug">{task.title}</span>
        )}
        <button
          type="button"
          data-nodrag
          aria-label={`Arrastar "${task.title}"`}
          onPointerDown={onHandlePointerDown}
          tabIndex={interactive ? 0 : -1}
          className="-mt-1 -mr-1 flex size-9 shrink-0 touch-none items-center justify-center rounded-[0.333em] text-white/40 transition-colors hover:bg-white/10 hover:text-white/80 md:size-7 md:cursor-grab"
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
            <circle cx="5.5" cy="3.5" r="1.2" />
            <circle cx="10.5" cy="3.5" r="1.2" />
            <circle cx="5.5" cy="8" r="1.2" />
            <circle cx="10.5" cy="8" r="1.2" />
            <circle cx="5.5" cy="12.5" r="1.2" />
            <circle cx="10.5" cy="12.5" r="1.2" />
          </svg>
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
        <span className={`text-[11px] ${overdue ? 'text-red-300' : 'text-white/60'}`}>
          {overdue ? 'Atrasada · ' : ''}
          {formatDate(task.due_date)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 text-[11px] text-white/50">
        <span>
          {task.attachments.length} {task.attachments.length === 1 ? 'anexo' : 'anexos'}
        </span>
        {showOwner && <span>Dono: {task.owner.name}</span>}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <select
          aria-label={`Mover "${task.title}" para`}
          value={task.status}
          disabled={!interactive}
          onChange={(event) => onMove?.(task, event.target.value as TaskStatus)}
          className={compactSelect}
        >
          {STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-nodrag
          disabled={!interactive}
          onClick={() => onDelete?.(task)}
          aria-label={`Excluir "${task.title}"`}
          className="min-h-9 shrink-0 rounded-[0.333em] px-3 text-xs text-red-300 transition-colors hover:bg-red-500/15 md:min-h-0 md:px-2 md:py-1"
        >
          Excluir
        </button>
      </div>
    </div>
  )
}
