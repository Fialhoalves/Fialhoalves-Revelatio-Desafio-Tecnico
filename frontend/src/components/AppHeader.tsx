import { useAuth } from '../contexts/AuthContext'
import { Badge, Button } from './ui'

export function AppHeader() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Task Manager</h1>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <Badge tone={user.role === 'ADMIN' ? 'indigo' : 'slate'}>{user.role === 'ADMIN' ? 'Administrador' : 'Usuário'}</Badge>
          <Button variant="secondary" onClick={logout}>
            Sair
          </Button>
        </div>
      </div>
    </header>
  )
}
