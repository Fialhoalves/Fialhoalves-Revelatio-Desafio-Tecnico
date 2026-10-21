import { useAuth } from '../contexts/AuthContext'
import { Badge, Button } from './ui'

export function AppHeader() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <header className="sticky top-0 z-30 mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
      <h1 className="rounded-[0.333em] bg-white/16 px-3.5 py-2 text-[13px] backdrop-blur-xl">Task Manager</h1>
      <div className="flex items-center gap-3 rounded-[0.333em] bg-white/16 py-1 pr-1 pl-3.5 backdrop-blur-xl">
        <div className="hidden text-right sm:block">
          <p className="text-[13px] leading-tight">{user.name}</p>
          <p className="text-[11px] text-white/60">{user.email}</p>
        </div>
        <Badge tone={user.role === 'ADMIN' ? 'indigo' : 'slate'}>{user.role === 'ADMIN' ? 'Administrador' : 'Usuário'}</Badge>
        <Button variant="outline" onClick={logout}>
          Sair
        </Button>
      </div>
    </header>
  )
}
