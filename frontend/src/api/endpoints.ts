import type { Attachment, Task, TaskFilters, TaskInput, TaskPage, TaskStats, User } from '../types'
import { request, requestBlob } from './client'

// O quadro mostra todas as colunas de uma vez, então busca o máximo que a API devolve por requisição.
export const BOARD_LIMIT = 100

export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      form: new URLSearchParams({ username: email, password }),
      auth: false,
    }),
  register: (name: string, email: string, password: string) =>
    request<User>('/auth/register', { method: 'POST', json: { name, email, password }, auth: false }),
  me: () => request<User>('/auth/me'),
}

export const usersApi = {
  list: () => request<User[]>('/users'),
}

export const tasksApi = {
  list: (filters: TaskFilters) => {
    const params = new URLSearchParams({
      sort: filters.sort,
      order: filters.order,
      limit: String(BOARD_LIMIT),
    })
    if (filters.q.trim()) params.set('q', filters.q.trim())
    if (filters.status) params.set('status', filters.status)
    if (filters.priority) params.set('priority', filters.priority)
    if (filters.overdue) params.set('overdue', 'true')
    if (filters.owner_id !== '') params.set('owner_id', String(filters.owner_id))
    return request<TaskPage>(`/tasks?${params}`)
  },
  stats: () => request<TaskStats>('/tasks/stats'),
  create: (input: TaskInput) => request<Task>('/tasks', { method: 'POST', json: input }),
  update: (id: number, input: Partial<TaskInput>) => request<Task>(`/tasks/${id}`, { method: 'PATCH', json: input }),
  complete: (id: number) => request<Task>(`/tasks/${id}/complete`, { method: 'POST' }),
  remove: (id: number) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
}

export const attachmentsApi = {
  upload: (taskId: number, file: File) => {
    const body = new FormData()
    body.append('files', file)
    return request<Attachment[]>(`/tasks/${taskId}/attachments`, { method: 'POST', body })
  },
  remove: (id: number) => request<void>(`/attachments/${id}`, { method: 'DELETE' }),
  // Download e preview exigem o token, então passam por fetch e viram Blob.
  fetchFile: (id: number, inline: boolean) => requestBlob(`/attachments/${id}/download${inline ? '?inline=true' : ''}`),
}
