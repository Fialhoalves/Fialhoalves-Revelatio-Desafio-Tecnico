# Contrato de erros da API

Toda resposta de erro tem o mesmo formato:

```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Tarefa não encontrada.",
    "details": [{ "field": "title", "type": "missing", "message": "Campo obrigatório." }]
  }
}
```

- `code` é estável e é o que o front usa para decidir o que fazer e o que mostrar. O front **nunca exibe o status HTTP nem o `code`** para o usuário.
- `message` é um texto amigável em português. O front pode usá-lo como padrão ou sobrescrever por `code`.
- `details` só aparece em `VALIDATION_ERROR` (um item por campo com problema).
- Erros inesperados nunca vazam detalhes internos: o servidor registra o erro no log e responde `INTERNAL_ERROR`.
- Para quem não tem acesso a uma task/anexo de outro usuário a API responde `*_NOT_FOUND` (404), e não 403, para não revelar que o recurso existe.

## Catálogo

| code | HTTP | Quando acontece | Ação sugerida no front |
|---|---|---|---|
| `AUTH_REQUIRED` | 401 | Chamada sem token | Redirecionar para o login |
| `AUTH_TOKEN_INVALID` | 401 | Token expirado, adulterado ou de usuário removido | Limpar sessão, ir ao login com aviso "sessão expirou" |
| `AUTH_INVALID_CREDENTIALS` | 401 | E-mail ou senha errados (mesma resposta nos dois casos) | Mostrar no formulário de login |
| `RATE_LIMITED` | 429 | Muitas tentativas de login malsucedidas para o mesmo IP e e-mail (o cabeçalho `Retry-After` indica os segundos de espera) | Mensagem no login e bloqueio temporário do botão |
| `PERMISSION_DENIED` | 403 | Usuário comum tentando área de admin | Aviso "sem permissão"; esconder a área |
| `EMAIL_ALREADY_REGISTERED` | 409 | Cadastro com e-mail já usado | Erro no campo e-mail; sugerir login |
| `TASK_NOT_FOUND` | 404 | Task inexistente **ou** de outro usuário | Voltar à lista com aviso |
| `ATTACHMENT_NOT_FOUND` | 404 | Anexo inexistente ou de outro usuário | Atualizar a lista de anexos |
| `ATTACHMENT_FILE_MISSING` | 404 | Registro existe, mas o arquivo sumiu do armazenamento | Aviso "arquivo indisponível" |
| `FILE_TYPE_NOT_ALLOWED` | 415 | Upload de tipo fora da allowlist | Aviso no upload listando tipos aceitos |
| `FILE_CONTENT_MISMATCH` | 415 | Os primeiros bytes do arquivo não condizem com o tipo declarado | Aviso no upload: arquivo corrompido ou com extensão trocada |
| `FILE_TOO_LARGE` | 413 | Upload acima de `MAX_UPLOAD_MB` (10 MB) | Aviso no upload com o limite |
| `VALIDATION_ERROR` | 422 | Campos inválidos | Marcar cada campo de `details[].field` |
| `DB_UNAVAILABLE` | 503 | Banco de dados fora do ar (health check de prontidão) | Tentar novamente depois |
| `NOT_FOUND` | 404 | Rota inexistente | Página "não encontrada" |
| `METHOD_NOT_ALLOWED` | 405 | Método HTTP errado | Erro genérico |
| `INTERNAL_ERROR` | 500 | Falha inesperada | "Algo deu errado, tente novamente" |

Campos de `details[].field` válidos hoje: `title`, `description`, `due_date`, `status`, `priority` (tasks) e `name`, `email`, `password` (cadastro).

## Onde está implementado

- Definição dos erros e handlers globais: `backend/app/core/errors.py`
- Um teste por código: `backend/tests/test_errors.py`
- Regras de acesso que geram 404/403: `backend/app/services/`
