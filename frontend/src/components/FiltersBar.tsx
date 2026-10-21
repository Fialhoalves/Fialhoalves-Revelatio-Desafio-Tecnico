import { useEffect, useState } from 'react'
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/format'
import type { Priority, TaskFilters, TaskStatus, User } from '../types'
import { inputClass } from './ui'

interface Props {
  filters: TaskFilters
  users: User[]
  isAdmin: boolean
  onChange: (patch: Partial<TaskFilters>) => void
}

export function FiltersBar({ filters, users, isAdmin, onChange }: Props) {
  const [search, setSearch] = useState(filters.q)

  // Busca com debounce de 300 ms para não consultar o servidor a cada tecla.
  useEffect(() => {
    if (search === filters.q) return
    const timer = setTimeout(() => onChange({ q: search }), 300)
    return () => clearTimeout(timer)
  }, [search, filters.q, onChange])

  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border border-white/12 bg-white/4 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar por título ou descrição"
        aria-label="Buscar tarefas"
        className={`${inputClass} sm:col-span-2`}
      />
      <select
        aria-label="Filtrar por status"
        value={filters.status}
        onChange={(event) => onChange({ status: event.target.value as TaskStatus | '' })}
        className={inputClass}
      >
        <option value="">Todos os status</option>
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label="Filtrar por prioridade"
        value={filters.priority}
        onChange={(event) => onChange({ priority: event.target.value as Priority | '' })}
        className={inputClass}
      >
        <option value="">Todas as prioridades</option>
        {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        aria-label="Ordenar por"
        value={filters.sort}
        onChange={(event) => onChange({ sort: event.target.value as TaskFilters['sort'] })}
        className={inputClass}
      >
        <option value="created_at">Ordenar por criação</option>
        <option value="due_date">Ordenar por prazo</option>
        <option value="priority">Ordenar por prioridade</option>
        <option value="title">Ordenar por título</option>
      </select>
      <select
        aria-label="Sentido da ordenação"
        value={filters.order}
        onChange={(event) => onChange({ order: event.target.value as 'asc' | 'desc' })}
        className={inputClass}
      >
        <option value="desc">Decrescente</option>
        <option value="asc">Crescente</option>
      </select>

      {isAdmin ? (
        <select
          aria-label="Filtrar por usuário"
          value={filters.owner_id}
          onChange={(event) => onChange({ owner_id: event.target.value === '' ? '' : Number(event.target.value) })}
          className={inputClass}
        >
          <option value="">Todos os usuários</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="hidden lg:block" />
      )}

      <label className="flex items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          checked={filters.overdue}
          onChange={(event) => onChange({ overdue: event.target.checked })}
          className="size-4 accent-white"
        />
        Somente atrasadas
      </label>
    </div>
  )
}
