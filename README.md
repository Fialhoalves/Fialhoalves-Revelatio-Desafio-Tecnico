# Task Manager

API REST para organização de tarefas com anexos, autenticação e controle de acesso por perfil. Desenvolvida como desafio técnico para a vaga de Back-End da Revelatio Studio.

## Visão geral

Cada usuário cadastra e acompanha suas tarefas (título, descrição, prazo, status e prioridade) e pode anexar imagens e documentos a elas. Usuários comuns enxergam apenas as próprias tarefas. Administradores enxergam e gerenciam as tarefas de todos.

Toda a autenticação e a autorização acontecem no servidor. O front-end apenas envia o token recebido no login.

## Funcionalidades

- Cadastro e login com JWT.
- Dois perfis: `USER` e `ADMIN`.
- CRUD de tarefas, com atalho para concluir.
- Filtro por status, busca por texto e paginação.
- Upload, listagem, download e remoção de anexos, com preview via `?inline=true`.
- Formato único de erro, com código estável e mensagem em português.
- Documentação interativa em `/docs` (Swagger).

## Stack e decisões técnicas

### FastAPI

Gera a documentação OpenAPI automaticamente, valida entrada e saída com Pydantic e expressa autenticação e permissões como dependências, o que mantém as regras de acesso explícitas e testáveis.

### PostgreSQL

Os dados são relacionais (usuário, tarefas e anexos) e se beneficiam de chaves estrangeiras, índices e exclusão em cascata.

### SQLAlchemy 2 e Alembic

Modelos tipados e migrations versionadas. O schema nunca é criado de forma implícita na subida da aplicação.

### JWT e bcrypt

Token de acesso com expiração configurável e senhas armazenadas apenas como hash bcrypt. O perfil do usuário é lido do banco a cada requisição, nunca do token nem do cliente.

### Armazenamento de anexos

Os arquivos ficam em disco (volume no Docker) com nome gerado por UUID, e os metadados ficam no banco. O acesso é encapsulado em `app/storage`, atrás de uma interface pequena, o que permite trocar por um serviço de objetos sem alterar as rotas. Downloads sempre passam pela API, que confere a permissão antes de servir o arquivo.

### Docker

`docker compose up` sobe API e banco com migrations e seed aplicados. A mesma imagem da API é usada no deploy.

## Arquitetura

```
backend/
  app/
    main.py          criação da aplicação, middlewares e routers
    core/            configuração, segurança (JWT, hash), dependências e erros
    db/              engine, sessão e base declarativa
    models/          entidades SQLAlchemy
    schemas/         modelos Pydantic de entrada e saída
    routers/         camada HTTP, sem regra de negócio
    services/        regras de negócio e de acesso
    storage/         armazenamento de arquivos
    seed.py          usuários iniciais
  alembic/           migrations
  tests/             testes automatizados
docs/                documentação complementar
docker-compose.yml
```

Fluxo de uma requisição: o router recebe e valida a entrada, as dependências resolvem o usuário autenticado, o service aplica as regras de acesso e de negócio e o resultado é serializado por um schema.

## Modelo de dados

```mermaid
erDiagram
    USERS ||--o{ TASKS : possui
    TASKS ||--o{ ATTACHMENTS : contem
    USERS {
        int id PK
        string name
        string email UK
        string password_hash
        string role
        datetime created_at
    }
    TASKS {
        int id PK
        string title
        text description
        date due_date
        string status
        string priority
        datetime created_at
        datetime updated_at
        int owner_id FK
    }
    ATTACHMENTS {
        int id PK
        int task_id FK
        string original_name
        string stored_name UK
        string content_type
        bigint size
        datetime created_at
    }
```

## Controle de acesso

| Ação | Usuário comum | Administrador |
|---|---|---|
| Criar tarefa | Sim | Sim |
| Listar tarefas | Apenas as próprias | Todas |
| Ver, editar e remover tarefa | Apenas as próprias | Qualquer uma |
| Anexar, baixar e remover anexo | Apenas nas próprias tarefas | Em qualquer tarefa |
| Listar usuários | Não | Sim |

Quando um usuário tenta acessar uma tarefa ou anexo de outra pessoa, a API responde `404`, o mesmo retorno de um item inexistente, para não revelar que o recurso existe. Um teste automatizado percorre todas as rotas e exige `401` sem token, exceto login, cadastro e health check.

## Como executar

### Com Docker

```bash
docker compose up --build
```

- API: http://localhost:8000
- Documentação: http://localhost:8000/docs

O seed cria dois usuários de demonstração:

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | admin@example.com | admin12345 |
| Usuário comum | user@example.com | user12345 |

### Sem Docker

Requisitos: Python 3.12 ou superior e um PostgreSQL acessível.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env             # ajuste DATABASE_URL se necessário
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

## Variáveis de ambiente

Os valores de exemplo estão em `backend/.env.example`.

| Variável | Descrição | Padrão |
|---|---|---|
| `DATABASE_URL` | Conexão com o PostgreSQL | banco local do compose |
| `SECRET_KEY` | Chave de assinatura do JWT | valor de desenvolvimento |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Validade do token | `60` |
| `CORS_ORIGINS` | Origens do front, separadas por vírgula | `http://localhost:5173` |
| `UPLOAD_DIR` | Pasta dos anexos | `uploads` |
| `MAX_UPLOAD_MB` | Tamanho máximo por arquivo | `10` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Administrador criado pelo seed | `admin@example.com`, `admin12345` |

## Testes

```bash
cd backend
pytest
```

Os testes cobrem autenticação, permissões entre perfis, CRUD de tarefas, filtros, upload e download de anexos, validações e cada código de erro do catálogo.

## API

Documentação interativa em `/docs`. Resumo das rotas:

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` | Cadastro de usuário comum |
| POST | `/auth/login` | Login, retorna o JWT |
| GET | `/auth/me` | Usuário autenticado |
| GET | `/users` | Lista usuários (admin) |
| POST | `/tasks` | Cria tarefa |
| GET | `/tasks` | Lista tarefas, com `status`, `q`, `owner_id`, `limit` e `offset` |
| GET | `/tasks/{id}` | Detalha tarefa |
| PATCH | `/tasks/{id}` | Edita tarefa |
| POST | `/tasks/{id}/complete` | Marca como concluída |
| DELETE | `/tasks/{id}` | Remove tarefa e seus arquivos |
| POST | `/tasks/{id}/attachments` | Envia um ou mais arquivos |
| GET | `/tasks/{id}/attachments` | Lista anexos da tarefa |
| GET | `/attachments/{id}/download` | Baixa o arquivo (`?inline=true` para preview) |
| DELETE | `/attachments/{id}` | Remove anexo |
| GET | `/health` | Verificação de saúde |

Os erros seguem o formato e o catálogo descritos em [docs/ERRORS.md](docs/ERRORS.md).

## Deploy

A API roda no Railway com PostgreSQL gerenciado e volume persistente para os anexos. O front-end é publicado na Vercel.

- API: a definir
- Front-end: a definir

## Uso de IA

Ferramenta utilizada: Claude Code, como assistente de programação no terminal.

Partes do projeto em que foi usada:

- estrutura inicial do backend, modelos, rotas e serviços;
- testes automatizados;
- migrations e arquivos de Docker;
- rascunho dos documentos em `docs/` e deste README.

Foram definidos manualmente a stack, o modelo de acesso (regras de dono e administrador), o contrato de erros e o escopo dos diferenciais. O código gerado foi executado, testado e revisado antes de cada commit.

## Vídeo de apresentação

Link: a definir

## Limitações conhecidas

- Os anexos ficam em disco local. Em mais de uma instância seria necessário um armazenamento compartilhado.
- O token de acesso não possui refresh nem revogação.
- O tipo do arquivo enviado é validado por uma lista de tipos permitidos e pelo limite de tamanho.
