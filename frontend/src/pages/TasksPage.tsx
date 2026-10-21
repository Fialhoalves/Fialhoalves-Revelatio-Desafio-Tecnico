import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BOARD_LIMIT, tasksApi, usersApi } from '../api/endpoints'
import { AppHeader } from '../components/AppHeader'
import { FiltersBar } from '../components/FiltersBar'
import { KanbanBoard } from '../components/KanbanBoard'
import { StatsCards } from '../components/StatsCards'
import { TaskFormDialog } from '../components/TaskFormDialog'
import { useToast } from '../components/Toast'
import { Alert, Button, ConfirmDialog, Spinner } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, errorMessage } from '../lib/errors'
import { STATUS_ORDER } from '../lib/tones'
import type { Task, TaskFilters, TaskPage, TaskStatus } from '../types'

const DEFAULT_FILTERS: TaskFilters = {
  q: '',
  status: '',
  priority: '',
  overdue: false,
  owner_id: '',
  sort: 'created_at',
  order: 'desc',
}

export default function TasksPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'ADMIN'

  const boardTop = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()
  // A página de usuários leva para cá com ?dono=ID, já filtrando as tarefas da pessoa (só para administradores).
  const [filters, setFilters] = useState<TaskFilters>(() => {
    const owner = Number(searchParams.get('dono'))
    return isAdmin && Number.isInteger(owner) && owner > 0 ? { ...DEFAULT_FILTERS, owner_id: owner } : DEFAULT_FILTERS
  })
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)

  const patchFilters = useCallback((patch: Partial<TaskFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
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

  // Troca de status pelo quadro: atualiza a tela na hora e desfaz se o servidor recusar.
  const move = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) => tasksApi.update(task.id, { status }),
    onMutate: async ({ task, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const snapshots = queryClient.getQueriesData<TaskPage>({ queryKey: ['tasks'] })
      queryClient.setQueriesData<TaskPage>({ queryKey: ['tasks'] }, (current) =>
        current && { ...current, items: current.items.map((item) => (item.id === task.id ? { ...item, status } : item)) },
      )
      return { snapshots }
    },
    onError: (error, _variables, context) => {
      context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data))
      onMutationError(error)
    },
    onSuccess: (_data, { status }) => {
      if (status === 'DONE') toast.success('Tarefa concluída.')
    },
    onSettled: refresh,
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
  const filteredOwner = users.data?.find((item) => item.id === filters.owner_id)
  const hasActiveFilters =
    filters.q !== '' || filters.status !== '' || filters.priority !== '' || filters.overdue || filters.owner_id !== ''

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-5 px-4 pt-6 pb-16">
        <h2 className="animate-rise text-4xl tracking-[-0.04em] sm:text-5xl">
          {isAdmin ? (filteredOwner ? `Tarefas de ${filteredOwner.name}` : 'Tarefas de todos os usuários') : 'Minhas tarefas'}
        </h2>

        {stats.data && (
          <StatsCards
            stats={stats.data}
            onSelectOwner={(ownerId) => {
              patchFilters({ owner_id: ownerId })
              boardTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
        )}

        <div ref={boardTop} className="flex scroll-mt-20 flex-wrap items-center justify-between gap-3 pt-4">
          <p className="text-sm text-white/60">{tasks.data ? `${total} ${total === 1 ? 'tarefa' : 'tarefas'}` : ''}</p>
          <Button onClick={() => setEditing('new')}>Nova tarefa</Button>
        </div>

        <FiltersBar filters={filters} users={users.data ?? []} isAdmin={isAdmin} onChange={patchFilters} />

        {tasks.isError && <Alert>{errorMessage(tasks.error)}</Alert>}

        {tasks.isPending && (
          <div className="grid gap-3 md:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-md bg-white/6" />
            ))}
          </div>
        )}

        {tasks.data && tasks.data.items.length === 0 && (
          <div className="rounded-md border border-dashed border-white/20 p-10 text-center">
            <p className="text-lg tracking-tight">{hasActiveFilters ? 'Nenhuma tarefa encontrada' : 'Você ainda não tem tarefas'}</p>
            <p className="mt-1 text-sm text-white/60">
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
          <div className={`transition-opacity ${tasks.isPlaceholderData ? 'opacity-60' : ''}`}>
            <KanbanBoard
              tasks={tasks.data.items}
              statuses={filters.status ? [filters.status] : STATUS_ORDER}
              showOwner={isAdmin}
              onMove={(task, status) => move.mutate({ task, status })}
              onComplete={(task) => move.mutate({ task, status: 'DONE' })}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
            {total > BOARD_LIMIT && (
              <p className="mt-3 text-center text-xs text-white/60">
                Mostrando as {BOARD_LIMIT} primeiras de {total} tarefas. Use os filtros para refinar.
              </p>
            )}
          </div>
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
