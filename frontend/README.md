# Front-end

Interface em React para a API do Task Manager.

## Stack

- React 19 e TypeScript
- Vite
- Tailwind CSS 4
- React Router
- TanStack Query (cache e sincronização com a API)

## Executar

```bash
npm install
cp .env.example .env     # VITE_API_URL aponta para a API
npm run dev              # http://localhost:5173
npm run build            # verificação de tipos e build de produção
```

A API precisa estar no ar (por padrão em `http://localhost:8000`) com o endereço do front em `CORS_ORIGINS`.

## Estrutura

```
src/
  api/          cliente HTTP (token, erros) e funções por recurso
  contexts/     autenticação
  components/   interface (tarefas, filtros, estatísticas, anexos, diálogos)
  pages/        login, cadastro e quadro de tarefas
  lib/          mensagens de erro, formatadores e download
  types/        tipos da API
```

## Decisões

- **Quadro kanban.** As tarefas ficam em colunas por status. Arrastar um cartão para outra coluna chama `PATCH /tasks/{id}` com o novo status. A tela atualiza na hora (atualização otimista do TanStack Query) e desfaz a mudança se a API recusar. Os filtros do servidor continuam disponíveis (busca por texto, status, prioridade, prazo vencido, dono e ordenação); com um status selecionado, o quadro mostra só aquela coluna. O quadro busca até 100 tarefas e avisa quando há mais.
- **Arrastar com Pointer Events.** O arrasto não usa o arrastar nativo do navegador, que não funciona com toque. Mouse e caneta arrastam de qualquer ponto do cartão; no toque o arrasto começa pela alça, para não bloquear a rolagem da página. O cartão levanta ao ser pego, a coluna de destino é destacada, a página rola sozinha perto das bordas, o cartão pousa com uma animação curta e, se for solto fora de uma coluna, volta ao lugar de origem. As animações respeitam `prefers-reduced-motion`.
- **Alternativa sem arrastar.** Cada cartão tem um seletor de status, que atende teclado e leitor de tela.
- **Celular.** Colunas empilhadas, alvos de toque de pelo menos 36 px e campos com fonte de 16 px para evitar o zoom automático do iOS.
- **Conferência de anexos.** No formulário, cada arquivo escolhido mostra miniatura (imagens) ou etiqueta do tipo, e pode ser visualizado em tamanho maior antes de salvar.
- **Autorização no servidor.** O front guarda o token e o envia em `Authorization`. Esconder botões por perfil é apenas conveniência visual; toda regra de acesso é validada pela API.
- **Erros por código.** O cliente converte as respostas de erro em `ApiError` e `src/lib/errors.ts` traduz cada `code` para uma mensagem em português. Status HTTP e código nunca são exibidos.
- **Anexos autenticados.** Preview e download usam `fetch` com o token e `URL.createObjectURL`, porque `<img src>` e links diretos não enviam o cabeçalho de autenticação.
- **Sessão expirada.** Uma resposta `AUTH_TOKEN_INVALID` limpa a sessão e leva ao login com aviso.
- **Datas.** O prazo é tratado como texto `AAAA-MM-DD`, sem conversão de fuso, para não deslocar o dia.

## Deploy na Vercel

- Root Directory: `frontend`
- Variável de ambiente: `VITE_API_URL` com a URL pública da API
- `vercel.json` já inclui o rewrite para rotas do React Router
- Na API, `CORS_ORIGINS` deve conter a URL final da Vercel
