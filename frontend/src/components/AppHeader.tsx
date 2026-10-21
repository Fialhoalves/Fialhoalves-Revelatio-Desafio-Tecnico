import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Badge, Button } from './ui'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center border-b px-1 text-[13px] transition-colors duration-[350ms] md:min-h-9 ${
    isActive ? 'border-white text-white' : 'border-transparent text-white/60 hover:text-white'
  }`

export function AppHeader() {
  const { user, logout } = useAuth()
  if (!user) return null
  const isAdmin = user.role === 'ADMIN'

  return (
    <header className="sticky top-0 z-30 mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
      <div className="flex min-w-0 items-center gap-4">
        <h1 className="rounded-[0.333em] bg-white/16 px-3.5 py-2 text-[13px] backdrop-blur-xl">Task Manager</h1>
        {/* Só conveniência de navegação: o servidor recusa /users e as tarefas alheias para quem não é administrador. */}
        {isAdmin && (
          <nav aria-label="Seções" className="flex items-center gap-4">
            <NavLink to="/" end className={navClass}>
              Tarefas
            </NavLink>
            <NavLink to="/usuarios" className={navClass}>
              Usuários
            </NavLink>
          </nav>
        )}
      </div>
      <div className="flex items-center gap-3 rounded-[0.333em] bg-white/16 py-1 pr-1 pl-3.5 backdrop-blur-xl">
        <div className="hidden text-right sm:block">
          <p className="text-[13px] leading-tight">{user.name}</p>
          <p className="text-[11px] text-white/60">{user.email}</p>
        </div>
        <Badge tone={isAdmin ? 'indigo' : 'slate'}>{isAdmin ? 'Administrador' : 'Usuário'}</Badge>
        <Button variant="outline" onClick={logout}>
          Sair
        </Button>
      </div>
    </header>
  )
}
