import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Field, inputClass, Spinner } from '../components/ui'
import { FLASH_KEY, useAuth } from '../contexts/AuthContext'
import { ApiError, errorMessage, fieldErrors } from '../lib/errors'

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Task Manager</p>
          <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </main>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice] = useState(() => {
    const flash = sessionStorage.getItem(FLASH_KEY)
    sessionStorage.removeItem(FLASH_KEY)
    return flash
  })
  const [submitting, setSubmitting] = useState(false)
  const [wait, setWait] = useState(0)

  // Contagem regressiva quando o servidor bloqueia temporariamente novas tentativas.
  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
      if (err instanceof ApiError && err.code === 'RATE_LIMITED' && err.retryAfter) setWait(err.retryAfter)
    } finally {
      setSubmitting(false)
    }
  }

  const minutes = Math.floor(wait / 60)
  const seconds = String(wait % 60).padStart(2, '0')

  return (
    <AuthLayout title="Entrar" subtitle="Acesse suas tarefas">
      <form onSubmit={submit} className="space-y-4">
        {notice && <Alert tone="info">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}
        <Field label="E-mail">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            autoFocus
            className={inputClass}
          />
        </Field>
        <Field label="Senha">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={submitting || wait > 0}>
          {submitting && <Spinner className="size-4 border-white/40 border-t-white" />}
          {wait > 0 ? `Tente novamente em ${minutes}:${seconds}` : 'Entrar'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Não tem conta?{' '}
        <Link to="/cadastro" className="font-medium text-indigo-600 hover:underline">
          Cadastre-se
        </Link>
      </p>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setErrors({})
    setError(null)
    setSubmitting(true)
    try {
      await register(name.trim(), email.trim(), password)
    } catch (err) {
      const fields = fieldErrors(err)
      if (err instanceof ApiError && err.code === 'EMAIL_ALREADY_REGISTERED') fields.email = errorMessage(err)
      setErrors(fields)
      setError(Object.keys(fields).length > 0 ? null : errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Criar conta" subtitle="Comece a organizar suas tarefas">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Nome" error={errors.name}>
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required autoFocus className={inputClass} />
        </Field>
        <Field label="E-mail" error={errors.email}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            className={inputClass}
          />
        </Field>
        <Field label="Senha" error={errors.password} hint="De 8 a 72 caracteres.">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            className={inputClass}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Spinner className="size-4 border-white/40 border-t-white" />}
          Criar conta
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Já tem conta?{' '}
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  )
}
