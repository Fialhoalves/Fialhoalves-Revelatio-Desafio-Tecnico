# Testes

## Como executar

```bash
cd backend
pytest                                   # SQLite em memória, cerca de um minuto
TEST_DATABASE_URL=postgresql+psycopg://usuario:senha@localhost:5432/banco_de_teste pytest
```

Na segunda forma a suíte roda contra PostgreSQL. O banco informado é recriado a cada teste, então deve ser um banco exclusivo para testes. O workflow de CI executa essa variante em um PostgreSQL 16.

## Como os testes são feitos

- **Framework:** pytest com o `TestClient` do FastAPI. Cada teste faz requisições HTTP reais contra a aplicação, passando por middlewares, validação, autenticação, services e banco. Não há mocks das regras de negócio.
- **Isolamento:** as tabelas são criadas antes e removidas depois de cada teste. Os anexos são gravados em uma pasta temporária descartada ao final.
- **Substituições:** apenas a sessão do banco e o storage são trocados, por meio do mecanismo de dependências do FastAPI.
- **Personagens prontos (fixtures):** `alice` e `bob` (usuários comuns) e `admin`. Cada fixture cria o usuário e já devolve o cabeçalho `Authorization` válido, o que deixa os testes de permissão curtos e legíveis.
- **Limite de login:** o contador em memória é zerado antes e depois de cada teste.

## O que cada arquivo cobre

| Arquivo | Execuções | O que verifica |
|---|---|---|
| `test_security_rules.py` | 20 | Uma execução por rota da API exigindo `401` sem token, exceto as rotas públicas listadas; descoberta de rotas não vazia; token falsificado ou expirado; perfil nunca aceito do cliente. |
| `test_errors.py` | 16 | Um teste por código do catálogo de erros, com status e `code` esperados; mesma resposta para e-mail inexistente e senha errada; validação com lista de campos; erro inesperado sem vazar detalhes. |
| `test_task_queries.py` | 14 | Filtros por prioridade, prazo e atraso; ordenação por prazo (sem prazo no fim), prioridade e título; paginação com total; campo de ordenação inválido; estatísticas para usuário e administrador. Busca do administrador pelo nome ou e-mail do dono, sem vazar tarefas de outros para o usuário comum. |
| `test_attachments.py` | 22 | 11 cenários executados nos dois backends de armazenamento (disco e PostgreSQL): ciclo de upload, listagem, download e remoção; nome com acentos no download; tipo não permitido; arquivo grande demais sem deixar resíduo; assinatura do conteúdo; acesso seguindo o dono; remoção do conteúdo ao apagar a tarefa; headers de segurança. |
| `test_health_and_config.py` | 9 | Raiz da API redirecionando para a documentação; health de vida e de prontidão (incluindo falha do banco); `SECRET_KEY` fraca rejeitada em produção e aceita em desenvolvimento. |
| `test_demo_seed.py` | 8 | Dados de demonstração: cobrem todas as colunas, prioridades, atraso e tarefa sem prazo; maioria das tarefas e todo usuário com anexos, incluindo Word e Excel; idempotência e reposição de anexos que faltam em tarefas existentes; arquivos gravados e baixáveis; pacotes Office bem formados; contas de exemplo com acesso só às próprias tarefas. |
| `test_openapi.py` | 2 | Documentação da API: o campo de upload aparece como seletor de arquivo no Swagger, e toda rota traz o campo summary e uma tag. |
| `test_tasks.py` | 7 | CRUD e conclusão; validações; isolamento entre usuários; administrador gerenciando tudo; filtros básicos; `owner_id` ignorado no corpo da requisição. |
| `test_auth.py` | 5 | Cadastro, login, e-mail duplicado, senha errada, `/users` restrito a administrador. |
| `test_rate_limit.py` | 4 | Bloqueio após falhas mesmo com a senha correta; sucesso zera o contador; contas independentes; expiração da janela com relógio simulado. |

## Por que esses testes

A contagem é consequência dos critérios abaixo, não uma meta. São 78 cenários distintos em 107 execuções; as demais são variações do mesmo cenário (o teste de autenticação roda uma vez para cada uma das 17 rotas e os testes de anexos rodam nos dois backends).

1. **Cada regra de acesso tem um caso permitido e um proibido.** Usuário comum e administrador contra cada recurso (tarefa, anexo, lista de usuários, estatísticas).
2. **Cada código de erro do catálogo tem um teste.** O front depende desses códigos, então eles fazem parte do contrato.
3. **Cada superfície de ataque tem um teste:** token forjado, token expirado, perfil enviado pelo cliente, arquivo com tipo declarado falso, arquivo grande, força bruta no login, chave fraca em produção.
4. **Cada regra de consulta é verificada no resultado,** não só no status: a ordem das tarefas, o total da paginação, o que cada perfil enxerga.
5. **Nenhuma rota nova fica sem proteção sem alguém perceber.** O teste de rotas lê o schema OpenAPI e falha para qualquer rota nova sem autenticação que não esteja na lista de rotas públicas.

## Verificação dos próprios testes

Para confirmar que os testes detectam falhas, três regras foram quebradas de propósito, uma por vez, e a suíte foi executada:

| Alteração feita | Resultado |
|---|---|
| Remover a checagem de dono em `get_accessible_task` | 3 testes falharam (tarefa alheia visível; anexo alheio acessível; resposta de erro de outro usuário) |
| Listagem de tarefas deixa de filtrar por dono para usuário comum | 3 testes falharam (isolamento da lista, filtro por dono e estatísticas) |
| Rota de listagem de anexos sem autenticação | 1 teste falhou (a execução da rota correspondente no teste de rotas) |

Depois de cada experimento o código foi restaurado e a suíte voltou a passar por completo.

## O que não é coberto

- Interface (front-end): os testes são apenas do backend.
- Carga e desempenho.
- Varredura de malware nos anexos: a validação confere a assinatura do conteúdo.
- Vários processos da API ao mesmo tempo (o limite de login é por processo).
