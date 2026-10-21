import type { Priority, TaskStatus } from '../types'

export type Tone = 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'indigo'

export const STATUS_TONE: Record<TaskStatus, Tone> = {
  PENDING: 'amber',
  IN_PROGRESS: 'blue',
  DONE: 'green',
}

export const PRIORITY_TONE: Record<Priority, Tone> = {
  LOW: 'slate',
  MEDIUM: 'indigo',
  HIGH: 'red',
}

/** Ordem das colunas do quadro, do início ao fim do fluxo. */
export const STATUS_ORDER: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE']
