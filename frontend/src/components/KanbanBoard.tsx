import { useState } from 'react'
import { formatDate, isOverdue, PRIORITY_LABEL, STATUS_LABEL } from '../lib/format'
import { PRIORITY_TONE, STATUS_ORDER } from '../lib/tones'
import type { Task, TaskStatus } from '../types'
import { Badge } from './ui'

const DOT: Record<TaskStatus, string> = {
  PENDING: 'bg-amber-300',
  IN_PROGRESS: 'bg-sky-300',
  DONE: 'bg-emerald-300',
}

const compactSelect =
  'block w-full rounded-[0.333em] border border-white/16 bg-white/5 px-2 py-1 text-xs text-white transition-colors duration-[350ms] focus:border-white/70 focus:outline-none disabled:opacity-50'

interface Props {
  tasks: Task[]
  showOwner: boolean
  onMove: (task: Task, status: TaskStatus) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export function KanbanBoard({ tasks, showOwner, onMove, onEdit, onDelete }: Props) {
  const [dragging, setDragging] = useState<Task | null>(null)
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null)

  const drop = (status: TaskStatus) => {
    if (dragging && dragging.status !== status) onMove(dragging, status)
    setDragging(null)
    setOverColumn(null)
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {STATUS_ORDER.map((status) => {
        const column = tasks.filter((task) => task.status === status)
        const active = overColumn === status && dragging !== null && dragging.status !== status
        return (
          <section
            key={status}
            aria-label={`Coluna ${STATUS_LABEL[status]}`}
            onDragOver={(event) => {
              if (!dragging) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setOverColumn(status)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverColumn(null)
            }}
            onDrop={(event) => {
              event.preventDefault()
              drop(status)
            }}
            className={`min-h-48 rounded-md border p-3 transition-colors duration-[350ms] ${
              active ? 'border-white/50 bg-white/10' : 'border-white/12 bg-white/4'
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
                  isDragging={dragging?.id === task.id}
                  onDragStart={() => setDragging(task)}
                  onDragEnd={() => {
                    setDragging(null)
                    setOverColumn(null)
                  }}
                  onMove={onMove}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
              {column.length === 0 && (
                <p className="rounded-md border border-dashed border-white/12 px-3 py-6 text-center text-xs text-white/40">
                  {dragging ? 'Solte aqui' : 'Nenhuma tarefa'}
                </p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

interface CardProps {
  task: Task
  showOwner: boolean
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMove: (task: Task, status: TaskStatus) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

function BoardCard({ task, showOwner, isDragging, onDragStart, onDragEnd, onMove, onEdit, onDelete }: CardProps) {
  const overdue = isOverdue(task.due_date, task.status)

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(task.id))
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={`cursor-grab rounded-md border border-white/12 bg-[#101010] p-3 transition-opacity active:cursor-grabbing ${
        isDragging ? 'opacity-40' : 'hover:border-white/24'
      }`}
    >
      <button
        type="button"
        onClick={() => onEdit(task)}
        className={`block w-full text-left text-sm leading-snug hover:underline ${task.status === 'DONE' ? 'text-white/40 line-through' : ''}`}
      >
        {task.title}
      </button>

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
          onChange={(event) => onMove(task, event.target.value as TaskStatus)}
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
          onClick={() => onDelete(task)}
          aria-label={`Excluir "${task.title}"`}
          className="shrink-0 rounded-[0.333em] px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/15"
        >
          Excluir
        </button>
      </div>
    </article>
  )
}
