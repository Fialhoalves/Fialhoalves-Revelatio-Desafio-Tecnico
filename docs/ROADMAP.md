# Roadmap do front-end

Rotas e seções previstas além do quadro de tarefas. A navegação de seções aparece apenas para administradores; o perfil comum usa uma única tela. Toda restrição de acesso continua sendo aplicada pela API: esconder um link ou redirecionar no front é apenas conveniência visual.

## Rotas atuais

| Rota | Perfil | Conteúdo |
| --- | --- | --- |
| `/login`, `/cadastro` | Público | Autenticação |
| `/` | Todos | Quadro de tarefas, com resumo por usuário para administradores |
| `/usuarios` | Administrador | Lista de usuários e perfis |

## Rotas previstas

| Rota | Perfil | Conteúdo | Dependência na API |
| --- | --- | --- | --- |
| `/usuarios/:id` | Administrador | Tarefas e resumo de um usuário | Filtro `owner_id` já existe |
| `/anexos` | Administrador | Visão geral dos arquivos enviados, com tamanho e dono | Nova rota de listagem |
| `/conta` | Todos | Dados do perfil e troca de senha | Novas rotas de perfil |

## Pendências de interface

- Atualização periódica dos contadores de resumo, para o odômetro refletir mudanças feitas por outros usuários.
- Paginação do quadro quando houver mais de 100 tarefas.
- Estado de erro por coluna do quadro. Hoje uma falha na consulta é exibida para o quadro inteiro; o estado vazio já existe em cada coluna.
