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
}

export function TaskCard({ task, showOwner, busy, onComplete, onEdit, onDelete }: Props) {
  const overdue = isOverdue(task.due_date, task.status)
  const done = task.status === 'DONE'

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className={`truncate text-base font-semibold ${done ? 'text-slate-400 line-through' : ''}`}>{task.title}</h3>
          {task.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{task.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
          <Badge tone={PRIORITY_TONE[task.priority]}>Prioridade {PRIORITY_LABEL[task.priority].toLowerCase()}</Badge>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className={overdue ? 'font-semibold text-red-600' : ''}>
          {overdue ? 'Atrasada · ' : 'Prazo: '}
          {formatDate(task.due_date)}
        </span>
        <span>
          {task.attachments.length} {task.attachments.length === 1 ? 'anexo' : 'anexos'}
        </span>
        {showOwner && <span>Dono: {task.owner.name}</span>}
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {!done && (
          <Button variant="secondary" onClick={() => onComplete(task)} disabled={busy}>
            Concluir
          </Button>
        )}
        <Button variant="secondary" onClick={() => onEdit(task)} disabled={busy}>
          Editar
        </Button>
        <Button variant="ghost" onClick={() => onDelete(task)} disabled={busy} className="text-red-600 hover:bg-red-50">
          Excluir
        </Button>
      </div>
    </article>
  )
}
