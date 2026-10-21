import type { Priority, TaskStatus } from '../types'

export const STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
}

/** Datas do servidor chegam como AAAA-MM-DD; formatar sem passar por Date evita deslocar o dia. */
export function formatDate(value: string | null): string {
  if (!value) return 'Sem prazo'
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

export function todayISO(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  return !!dueDate && status !== 'DONE' && dueDate < todayISO()
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

/** Validação rápida no cliente apenas para feedback; o servidor valida de verdade. */
export function checkFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return `${file.name}: o arquivo é maior que 10 MB.`
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) return `${file.name}: tipo de arquivo não aceito.`
  return null
}
