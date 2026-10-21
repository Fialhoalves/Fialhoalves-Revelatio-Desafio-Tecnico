import { formatDate, isOverdue, PRIORITY_LABEL, STATUS_LABEL } from '../lib/format'
import type { Priority, Task, TaskStatus } from '../types'
import { Badge, Button } from './ui'

const STATUS_TONE: Record<TaskStatus, 'amber' | 'blue' | 'green'> = {
  PENDING: 'amber',
  IN_PROGRESS: 'blue',
  DONE: 'green',
}

const PRIORITY_TONE: Record<Priority, 'slate' | 'indigo' | 'red'> = {
  LOW: 'slate',
  MEDIUM: 'indigo',
  HIGH: 'red',
}

interface Props {
  task: Task
  showOwner: boolean
  busy: boolean
  onComplete: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  index?: number
}

export function TaskCard({ task, showOwner, busy, onComplete, onEdit, onDelete, index = 0 }: Props) {
  const overdue = isOverdue(task.due_date, task.status)
  const done = task.status === 'DONE'

  return (
    <article
      className="animate-rise rounded-md border border-white/12 bg-white/4 p-5 transition-colors duration-[350ms] hover:border-white/24 hover:bg-white/6"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className={`truncate text-lg tracking-tight ${done ? 'text-white/40 line-through' : ''}`}>{task.title}</h3>
          {task.description && <p className="mt-1 line-clamp-2 text-sm text-white/60">{task.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
          <Badge tone={PRIORITY_TONE[task.priority]}>Prioridade {PRIORITY_LABEL[task.priority].toLowerCase()}</Badge>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
        <span className={overdue ? 'text-red-300' : ''}>
          {overdue ? 'Atrasada · ' : 'Prazo: '}
          {formatDate(task.due_date)}
        </span>
        <span>
          {task.attachments.length} {task.attachments.length === 1 ? 'anexo' : 'anexos'}
        </span>
        {showOwner && <span>Dono: {task.owner.name}</span>}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {!done && (
          <Button variant="secondary" onClick={() => onComplete(task)} disabled={busy}>
            Concluir
          </Button>
        )}
        <Button variant="secondary" onClick={() => onEdit(task)} disabled={busy}>
          Editar
        </Button>
        <Button variant="danger" onClick={() => onDelete(task)} disabled={busy}>
          Excluir
        </Button>
      </div>
    </article>
  )
}
