import { ApiError, networkError, type FieldError } from '../lib/errors'

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8000'
const TOKEN_KEY = 'task-manager.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

let onSessionExpired: (() => void) | null = null
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler
}

interface RequestOptions {
  method?: string
  json?: unknown
  form?: URLSearchParams
  body?: FormData
  auth?: boolean
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {}
  const token = tokenStore.get()
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`

  let body: BodyInit | undefined
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.json)
  } else if (options.form) {
    body = options.form
  } else if (options.body) {
    body = options.body
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, { method: options.method ?? 'GET', headers, body })
  } catch {
    throw networkError()
  }

  if (!response.ok) throw await toApiError(response, options.auth !== false)
  return response
}

async function toApiError(response: Response, authenticated: boolean): Promise<ApiError> {
  let code = 'HTTP_ERROR'
  let message = 'Não foi possível concluir a ação.'
  let details: FieldError[] = []
  try {
    const data = await response.json()
    if (data?.error) {
      code = data.error.code ?? code
      message = data.error.message ?? message
      details = data.error.details ?? []
    }
  } catch {
    // resposta sem corpo JSON
  }
  const retry = Number(response.headers.get('Retry-After'))
  const error = new ApiError(code, message, response.status, details, Number.isFinite(retry) && retry > 0 ? retry : null)

  if (authenticated && (code === 'AUTH_TOKEN_INVALID' || code === 'AUTH_REQUIRED')) onSessionExpired?.()
  return error
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function requestBlob(path: string): Promise<Blob> {
  const response = await send(path, {})
  return response.blob()
}
