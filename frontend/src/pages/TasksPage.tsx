import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { PAGE_SIZE, tasksApi, usersApi } from '../api/endpoints'
import { AppHeader } from '../components/AppHeader'
import { FiltersBar } from '../components/FiltersBar'
import { StatsCards } from '../components/StatsCards'
import { TaskCard } from '../components/TaskCard'
import { TaskFormDialog } from '../components/TaskFormDialog'
import { useToast } from '../components/Toast'
import { Alert, Button, ConfirmDialog, Spinner } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, errorMessage } from '../lib/errors'
import type { Task, TaskFilters } from '../types'

const DEFAULT_FILTERS: TaskFilters = {
  q: '',
  status: '',
  priority: '',
  overdue: false,
  owner_id: '',
  sort: 'created_at',
  order: 'desc',
  page: 1,
}

export default function TasksPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'ADMIN'

  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS)
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)

  // Qualquer mudança de filtro volta para a primeira página, exceto a troca de página em si.
  const patchFilters = useCallback((patch: Partial<TaskFilters>) => {
    setFilters((current) => ({ ...current, page: 1, ...patch }))
  }, [])

  const tasks = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => tasksApi.list(filters),
    placeholderData: keepPreviousData,
  })
  const stats = useQuery({ queryKey: ['stats'], queryFn: tasksApi.stats })
  const users = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: isAdmin })

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }, [queryClient])

  const onMutationError = (error: unknown) => {
    toast.error(errorMessage(error))
    if (error instanceof ApiError && error.code === 'TASK_NOT_FOUND') refresh()
  }

  const complete = useMutation({
    mutationFn: (task: Task) => tasksApi.complete(task.id),
    onSuccess: () => {
      toast.success('Tarefa concluída.')
      refresh()
    },
    onError: onMutationError,
  })

  const remove = useMutation({
    mutationFn: (task: Task) => tasksApi.remove(task.id),
    onSuccess: () => {
      toast.success('Tarefa excluída.')
      setDeleting(null)
      refresh()
    },
    onError: (error) => {
      setDeleting(null)
      onMutationError(error)
    },
  })

  const total = tasks.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Se a última tarefa de uma página for removida, volta uma página.
  useEffect(() => {
    if (tasks.data && tasks.data.items.length === 0 && filters.page > 1) {
      setFilters((current) => ({ ...current, page: Math.min(current.page, totalPages) }))
    }
  }, [tasks.data, filters.page, totalPages])

  const hasActiveFilters =
    filters.q !== '' || filters.status !== '' || filters.priority !== '' || filters.overdue || filters.owner_id !== ''

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        {stats.data && <StatsCards stats={stats.data} />}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{isAdmin ? 'Tarefas de todos os usuários' : 'Minhas tarefas'}</h2>
          <Button onClick={() => setEditing('new')}>Nova tarefa</Button>
        </div>

        <FiltersBar filters={filters} users={users.data ?? []} isAdmin={isAdmin} onChange={patchFilters} />

        {tasks.isError && <Alert>{errorMessage(tasks.error)}</Alert>}

        {tasks.isPending && (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
            ))}
          </div>
        )}

        {tasks.data && tasks.data.items.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-medium">{hasActiveFilters ? 'Nenhuma tarefa encontrada' : 'Você ainda não tem tarefas'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {hasActiveFilters ? 'Ajuste ou limpe os filtros para ver mais resultados.' : 'Crie a primeira para começar a se organizar.'}
            </p>
            <div className="mt-4">
              {hasActiveFilters ? (
                <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Limpar filtros
                </Button>
              ) : (
                <Button onClick={() => setEditing('new')}>Nova tarefa</Button>
              )}
            </div>
          </div>
        )}

        {tasks.data && tasks.data.items.length > 0 && (
          <div className={`space-y-3 transition-opacity ${tasks.isPlaceholderData ? 'opacity-60' : ''}`}>
            {tasks.data.items.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                showOwner={isAdmin}
                busy={complete.isPending || remove.isPending}
                onComplete={(item) => complete.mutate(item)}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <nav aria-label="Paginação" className="flex items-center justify-between">
            <Button variant="secondary" disabled={filters.page <= 1} onClick={() => patchFilters({ page: filters.page - 1 })}>
              Anterior
            </Button>
            <span className="text-sm text-slate-600">
              Página {filters.page} de {totalPages} · {total} tarefas
            </span>
            <Button
              variant="secondary"
              disabled={filters.page >= totalPages}
              onClick={() => patchFilters({ page: filters.page + 1 })}
            >
              Próxima
            </Button>
          </nav>
        )}

        {tasks.isFetching && !tasks.isPending && <Spinner className="fixed bottom-4 right-4" />}
      </main>

      {editing && (
        <TaskFormDialog task={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onChanged={refresh} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Excluir tarefa"
          message={`Excluir "${deleting.title}"? Os anexos também serão removidos. Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  )
}
