import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CircleCursor } from './components/CircleCursor'
import { Spinner } from './components/ui'
import { useAuth } from './contexts/AuthContext'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import TasksPage from './pages/TasksPage'

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
        <Route path="/" element={<Protected><TasksPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
