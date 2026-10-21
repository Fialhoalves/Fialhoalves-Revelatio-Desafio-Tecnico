export type Role = 'USER' | 'ADMIN'
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  created_at: string
}

export interface Attachment {
  id: number
  task_id: number
  original_name: string
  content_type: string
  size: number
  created_at: string
}

export interface Task {
  id: number
  title: string
  description: string | null
  due_date: string | null
  status: TaskStatus
  priority: Priority
  created_at: string
  updated_at: string
  owner: { id: number; name: string }
  attachments: Attachment[]
}

export interface TaskPage {
  items: Task[]
  total: number
}

export interface OwnerStats {
  owner_id: number
  owner_name: string
  total: number
  by_status: Record<TaskStatus, number>
}

export interface TaskStats {
  total: number
  overdue: number
  by_status: Record<TaskStatus, number>
  by_priority: Record<Priority, number>
  by_owner: OwnerStats[] | null
}

export interface TaskInput {
  title: string
  description: string | null
  due_date: string | null
  status: TaskStatus
  priority: Priority
}

export interface TaskFilters {
  q: string
  status: TaskStatus | ''
  priority: Priority | ''
  overdue: boolean
  owner_id: number | ''
  sort: 'created_at' | 'due_date' | 'priority' | 'title'
  order: 'asc' | 'desc'
  page: number
}
