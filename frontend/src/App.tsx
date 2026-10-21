import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CircleCursor } from './components/CircleCursor'
import { Spinner } from './components/ui'
import { useAuth } from './contexts/AuthContext'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import TasksPage from './pages/TasksPage'
import UsersPage from './pages/UsersPage'

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="size-8" />
    </div>
  )
}

// Apenas conveniência de navegação: o servidor recusa qualquer chamada sem token válido.
function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  return user ? children : <Navigate to="/login" replace />
}

// Também só conveniência: GET /users responde 403 a quem não é administrador.
function AdminOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  return user.role === 'ADMIN' ? children : <Navigate to="/" replace />
}

// Uma URL nova (por exemplo, o link "Tarefas" do menu depois de abrir ?dono=ID) reinicia os filtros.
function TasksRoute() {
  const { search } = useLocation()
  return <TasksPage key={search} />
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  return user ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <>
      <CircleCursor />
      <Routes>
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/cadastro" element={<PublicOnly><RegisterPage /></PublicOnly>} />
        <Route path="/" element={<Protected><TasksRoute /></Protected>} />
        <Route path="/usuarios" element={<AdminOnly><UsersPage /></AdminOnly>} />
        <Route path="*"element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
