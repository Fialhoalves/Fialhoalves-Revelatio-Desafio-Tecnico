export interface FieldError {
  field: string
  type: string
  message: string
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: FieldError[]
  readonly retryAfter: number | null

  constructor(
    code: string,
    message: string,
    status: number,
    details: FieldError[] = [],
    retryAfter: number | null = null,
  ) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
    this.retryAfter = retryAfter
  }
}

const NETWORK_MESSAGE = 'Não foi possível conectar ao servidor. Verifique sua conexão.'

// Mensagens exibidas ao usuário por código de erro. O status HTTP e o código nunca são mostrados.
const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Faça login para continuar.',
  AUTH_TOKEN_INVALID: 'Sua sessão expirou. Entre novamente.',
  AUTH_INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  RATE_LIMITED: 'Muitas tentativas de login. Aguarde alguns minutos.',
  EMAIL_ALREADY_REGISTERED: 'Já existe uma conta com este e-mail.',
  PERMISSION_DENIED: 'Você não tem permissão para esta ação.',
  TASK_NOT_FOUND: 'Esta tarefa não existe mais ou não está disponível.',
  ATTACHMENT_NOT_FOUND: 'Este anexo não está mais disponível.',
  ATTACHMENT_FILE_MISSING: 'O arquivo deste anexo não está mais disponível.',
  FILE_TYPE_NOT_ALLOWED: 'Este tipo de arquivo não é aceito. Use imagens, PDF, TXT, CSV, Word ou Excel.',
  FILE_CONTENT_MISMATCH: 'O arquivo parece corrompido ou com a extensão trocada.',
  FILE_TOO_LARGE: 'O arquivo é maior que 10 MB.',
  VALIDATION_ERROR: 'Confira os campos informados.',
  DB_UNAVAILABLE: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
  INTERNAL_ERROR: 'Algo deu errado do nosso lado. Tente novamente em instantes.',
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR') return NETWORK_MESSAGE
    return MESSAGES[error.code] ?? error.message
  }
  return 'Algo deu errado. Tente novamente.'
}

export function networkError(): ApiError {
  return new ApiError('NETWORK_ERROR', NETWORK_MESSAGE, 0)
}

/** Mapeia os erros de validação do servidor para mensagens por campo. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  const result: Record<string, string> = {}
  for (const detail of error.details) {
    if (detail.field && !result[detail.field]) result[detail.field] = detail.message
  }
  return result
}
