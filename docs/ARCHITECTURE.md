# Arquitetura

## Visão geral

A API é uma aplicação FastAPI em camadas, com PostgreSQL como banco e disco (volume) como armazenamento de anexos. O front-end é uma aplicação separada que consome a API via HTTP.

```
Cliente (front ou Swagger)
        |
        v
  Middlewares: CORS, log de requisição, headers de segurança
        |
        v
  Routers (HTTP, validação de entrada)
        |
        v
  Dependências: sessão do banco, usuário autenticado, perfil
        |
        v
  Services (regras de negócio e de acesso)
        |
        +--> SQLAlchemy --> PostgreSQL
        +--> Storage ------> disco / volume
```

## Camadas

| Camada | Pasta | Responsabilidade |
|---|---|---|
| Routers | `app/routers` | Receber a requisição, declarar dependências e devolver o schema de saída. Sem regra de negócio. |
| Dependências | `app/core/deps.py` | Resolver sessão do banco, usuário do token e exigência de perfil. |
| Services | `app/services` | Regras de acesso (dono ou administrador), listagem com filtros, estatísticas e fluxo de anexos. |
| Schemas | `app/schemas` | Contratos de entrada e saída (Pydantic). |
| Models | `app/models` | Entidades e relações (SQLAlchemy). |
| Storage | `app/storage` | Gravação, leitura e remoção de arquivos. |
| Core | `app/core` | Configuração, segurança, erros, logs, middlewares e limite de login. |

## Autenticação e autorização

1. `POST /auth/login` valida e-mail e senha (bcrypt) e devolve um JWT assinado com `SECRET_KEY`, contendo apenas o id do usuário e a expiração.
2. Cada requisição protegida decodifica o token, busca o usuário no banco e usa o perfil armazenado ali. O perfil nunca vem do token nem do cliente.
3. A regra "dono ou administrador" está em um único lugar (`get_accessible_task` e `get_accessible_attachment`). Todas as rotas de tarefas e anexos passam por ela.
4. Para quem não tem acesso a um recurso a resposta é `404`, igual à de um recurso inexistente.
5. Um teste lê o schema OpenAPI, percorre todas as rotas e exige `401` sem token, exceto uma lista explícita de rotas públicas.

Tentativas de login malsucedidas são limitadas por IP e e-mail (5 falhas em 15 minutos por padrão), com resposta `429` e cabeçalho `Retry-After`.

## Anexos

- O tipo declarado no upload precisa estar na lista de tipos permitidos.
- Os primeiros bytes do arquivo são conferidos contra a assinatura do tipo declarado (PNG, JPEG, GIF, WebP, PDF, formatos Office). Arquivos de texto não podem conter bytes nulos nem cabeçalhos de formatos binários.
- O tamanho é limitado durante a gravação, em blocos, sem carregar o arquivo inteiro em memória.
- O nome gravado é um UUID. O nome original fica apenas no banco, para exibição e para o cabeçalho de download.
- Downloads passam pela API e conferem a permissão. As respostas levam `X-Content-Type-Options: nosniff` e, para anexos, `Content-Security-Policy: sandbox`.
- O banco guarda os metadados; remover uma tarefa ou um anexo remove também o arquivo.

## Erros

Toda falha usa o formato `{"error": {"code", "message", "details"}}`. O catálogo está em [ERRORS.md](ERRORS.md). Erros inesperados são registrados no log com stack trace e devolvem apenas `INTERNAL_ERROR` ao cliente.

## Observabilidade

- Log por requisição: método, rota, status, duração e `X-Request-ID`. A query string não é registrada.
- Respostas `5xx` são registradas no nível de erro.
- `GET /health` indica que o processo está de pé. `GET /health/ready` confirma a conexão com o banco e responde `503` quando ela falha.

## Configuração

Toda a configuração vem de variáveis de ambiente (`app/core/config.py`). Com `ENVIRONMENT=production` a aplicação não inicia se `SECRET_KEY` for o valor de desenvolvimento ou tiver menos de 32 caracteres. A variável `DATABASE_URL` aceita os prefixos `postgres://` e `postgresql://` usados pelo Railway.

## Dados e migrations

O schema é versionado com Alembic. A imagem Docker aplica `alembic upgrade head` e o seed (idempotente) a cada inicialização. O pipeline de CI aplica e reverte as migrations em um PostgreSQL limpo antes de executar os testes.

## Testes

A suíte usa SQLite em memória por padrão e PostgreSQL quando `TEST_DATABASE_URL` está definida. O CI executa a suíte contra PostgreSQL 16. Os testes chamam a API por HTTP (TestClient) e substituem apenas a sessão do banco e o storage.

## Decisões e alternativas

| Tema | Escolha | Alternativa descartada | Motivo |
|---|---|---|---|
| Autorização | Camada de services | Verificação nos routers | Evita repetir a regra e facilita testar |
| Recurso de outro usuário | `404` | `403` | Não revela a existência do recurso |
| Anexos | Disco atrás de interface | Arquivo no banco | Mantém o banco leve; a interface permite trocar por S3 |
| Sessão | JWT de acesso | Sessão em servidor | Sem estado no servidor, suficiente para o escopo |
| Limite de login | Em memória | Redis | Sem dependência extra; limitação documentada |
| Erros | Código estável + mensagem | Apenas status HTTP | O front decide a mensagem a partir do código |

## Limitações

- O limite de login e o armazenamento em disco não são compartilhados entre instâncias.
- Não há refresh token nem revogação de sessão.
- A assinatura do arquivo confere o início do conteúdo, não faz varredura de malware.
