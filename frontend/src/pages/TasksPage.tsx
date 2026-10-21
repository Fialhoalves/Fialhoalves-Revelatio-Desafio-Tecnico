import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { PAGE_SIZE, tasksApi, usersApi } from '../api/endpoints'
import { AppHeader } from '../components/AppHeader'
import { FiltersBar } from '../components/FiltersBar'
import { KanbanBoard } from '../components/KanbanBoard'
import { StatsCards } from '../components/StatsCards'
import { TaskCard } from '../components/TaskCard'
import { TaskFormDialog } from '../components/TaskFormDialog'
import { useToast } from '../components/Toast'
import { Alert, Button, ConfirmDialog, Spinner } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { ApiError, errorMessage } from '../lib/errors'
import type { Task, TaskFilters, TaskPage, TaskStatus } from '../types'

type View = 'list' | 'board'

const VIEW_KEY = 'task-manager.view'
// O quadro mostra todas as colunas de uma vez, então busca até o máximo que a API devolve por página.
const BOARD_LIMIT = 100

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

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list'
  } catch {
    return 'list'
  }
}

export default function TasksPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'ADMIN'

  const [view, setView] = useState<View>(loadView)
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS)
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)

  const changeView = (next: View) => {
    setView(next)
    setFilters((current) => ({ ...current, page: 1 }))
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // preferência de visualização é opcional
    }
  }

  // Qualquer mudança de filtro volta para a primeira página, exceto a troca de página em si.
  const patchFilters = useCallback((patch: Partial<TaskFilters>) => {
    setFilters((current) => ({ ...current, page: 1, ...patch }))
  }, [])

  const board = view === 'board'
  // No quadro o status é a coluna, então o filtro de status não se aplica.
  const queryFilters: TaskFilters = board ? { ...filters, status: '', page: 1 } : filters
  const limit = board ? BOARD_LIMIT : PAGE_SIZE

  const tasks = useQuery({
    queryKey: ['tasks', view, queryFilters],
    queryFn: () => tasksApi.list(queryFilters, limit),
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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Se a última tarefa de uma página for removida, volta uma página.
  useEffect(() => {
    if (!board && tasks.data && tasks.data.items.length === 0 && filters.page > 1) {
      setFilters((current) => ({ ...current, page: Math.min(current.page, totalPages) }))
    }
  }, [board, tasks.data, filters.page, totalPages])

  const hasActiveFilters =
    filters.q !== '' ||
    (!board && filters.status !== '') ||
    filters.priority !== '' ||
    filters.overdue ||
    filters.owner_id !== ''

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-5 px-4 pt-6 pb-16">
        <h2 className="animate-rise text-4xl tracking-[-0.04em] sm:text-5xl">
          {isAdmin ? 'Tarefas de todos os usuários' : 'Minhas tarefas'}
        </h2>

        {stats.data && <StatsCards stats={stats.data} />}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <p className="text-sm text-white/60">{tasks.data ? `${total} ${total === 1 ? 'tarefa' : 'tarefas'}` : ''}</p>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Modo de visualização" className="flex rounded-[0.333em] border border-white/16 p-0.5">
              {(['list', 'board'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => changeView(option)}
                  className={`rounded-[3px] px-3 py-1.5 text-[13px] transition-colors duration-[350ms] ${
                    view === option ? 'bg-white text-black' : 'text-white/70 hover:text-white'
                  }`}
                >
                  {option === 'list' ? 'Lista' : 'Quadro'}
                </button>
              ))}
            </div>
            <Button onClick={() => setEditing('new')}>Nova tarefa</Button>
          </div>
        </div>

        <FiltersBar filters={filters} users={users.data ?? []} isAdmin={isAdmin} onChange={patchFilters} showStatus={!board} />

        {tasks.isError && <Alert>{errorMessage(tasks.error)}</Alert>}

        {tasks.isPending && (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-md bg-white/6" />
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

        {tasks.data && tasks.data.items.length > 0 && board && (
          <div className={`transition-opacity ${tasks.isPlaceholderData ? 'opacity-60' : ''}`}>
            <KanbanBoard
              tasks={tasks.data.items}
              showOwner={isAdmin}
              onMove={(task, status) => move.mutate({ task, status })}
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

        {tasks.data && tasks.data.items.length > 0 && !board && (
          <div className={`space-y-3 transition-opacity ${tasks.isPlaceholderData ? 'opacity-60' : ''}`}>
            {tasks.data.items.map((task, index) => (
              <TaskCard
                key={task.id}
                index={index}
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

        {!board && total > PAGE_SIZE && (
          <nav aria-label="Paginação" className="flex items-center justify-between">
            <Button variant="secondary" disabled={filters.page <= 1} onClick={() => patchFilters({ page: filters.page - 1 })}>
              Anterior
            </Button>
            <span className="text-sm text-white/60">
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
