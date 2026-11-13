# Event Feedback Web Frontend

Frontend independente em React, TypeScript e Vite. O navegador acessa somente
**http://localhost:5173** e URLs relativas `/api/...`. Vite e Docker são modos
alternativos: **não podem ocupar a porta 5173 simultaneamente**. Vite usa
`strictPort` e falha se ela estiver ocupada, em vez de escolher outra porta.

| Rota no frontend | Vite → backend no host | Nginx → backend na rede Docker |
| --- | --- | --- |
| `/api/auth` e `/api/auth/*` | `http://127.0.0.1:8080` | `http://ef-organizer:8080` |
| `/api/events` e `/api/events/*` | `http://127.0.0.1:8087` | `http://ef-survey:8087` |
| `/api/public` e `/api/public/*` | `http://127.0.0.1:8087` | `http://ef-survey:8087` |

Os proxies preservam caminho, query string, método, corpo, cookies, CSRF e
status HTTP. Redirecionamentos para a origem interna configurada são reescritos
para a origem pública; as APIs atuais usam 204 no login/logout. `/s/{token}`
continua com fallback SPA. Rotas `/api/*` desconhecidas e erros das APIs nunca
caem no `index.html`. Não é necessário habilitar CORS nem chamar 8080/8087 no
JavaScript do navegador.

## Backend Docker: preparação comum

Pré-requisitos: repositório backend `event-feedback` ao lado deste, Docker com
Compose v2 e backend configurado conforme seu próprio README. Os comandos abaixo
são para execução pelo desenvolvedor; este frontend não inicia nem modifica os
serviços, migrations ou credenciais do backend automaticamente.

Na pasta **do backend**, siga o setup de segurança existente (primeiro uso:
`python3 scripts/init_local_security.py`, que não imprime a chave) e execute:

```bash
cd ../event-feedback
docker compose config --quiet
docker compose up -d --build --wait
```

O Organizer deve publicar `127.0.0.1:8080` e o Survey `127.0.0.1:8087`.
Essas portas são usadas pelos proxies e por diagnósticos, não pelo navegador.
Se outro projeto já usar uma dessas portas, resolva o conflito antes de iniciar;
não pare containers de outros projetos automaticamente. Preserve o projeto
Compose e os volumes existentes, seguindo as instruções de cutover do backend
se ainda houver um container `api` legado.

Os serviços precisam compartilhar a mesma `CSRF_SIGNING_KEY` e
`SESSION_COOKIE_SECURE=false` no HTTP local. Configure
`PUBLIC_BASE_URL=http://localhost:5173` no Survey para que `publicUrl` aponte para
o frontend. Cookies de sessão devem ser host-only, com `Path=/` e
`SameSite=Lax`. Não exponha chaves em `VITE_*`, código, logs ou URLs.
O frontend usa o `publicUrl` retornado pela API, sem fabricar links.
Use uma conta de teste já autorizada; para banco sem usuários, o README do
backend documenta o bootstrap. Não é necessário cadastrar contas pelo frontend.

## Modo 1: frontend Vite + backend Docker

Pare o frontend Docker deste repositório, se estiver em execução. Na pasta
**deste frontend**, com Node 22.12 ou superior da linha 22:

```bash
docker compose down
npm ci
npm run dev
```

Acesse **http://localhost:5173**. O Vite se comunica com as portas publicadas
pelo backend no host; não precisa ingressar na rede Docker. Pare com Ctrl+C.
`npm run build` e `vite preview` não substituem o servidor de proxy de
desenvolvimento; em produção, use o Nginx ou rewrites da hospedagem.

## Modo 2: frontend Docker + backend Docker

Pare o Vite com Ctrl+C. Crie a rede compartilhada uma vez e conecte os dois
serviços existentes aos aliases esperados, sem editar arquivos do backend.
Execute na pasta **deste frontend**, após iniciar o backend:

```bash
docker network inspect event-feedback-dev >/dev/null 2>&1 || docker network create event-feedback-dev
docker network connect --alias ef-organizer event-feedback-dev "$(docker compose --project-directory ../event-feedback -f ../event-feedback/compose.yml ps -q organizer-service)"
docker network connect --alias ef-survey event-feedback-dev "$(docker compose --project-directory ../event-feedback -f ../event-feedback/compose.yml ps -q survey-service)"
docker compose up --build -d --wait
docker compose ps
```

Acesse **http://localhost:5173**. Os comandos `network connect` são necessários
somente enquanto os containers ainda não estiverem nessa rede; após recriar um
backend, conecte seu novo container novamente. Não conecte o container legado
`api` como Organizer. A rede externa é um pré-requisito explícito do Compose e
não é removida por `docker compose down` deste frontend.

O Compose sobe somente o frontend (Node 22 no build; Nginx sem root em 8080
internamente). A resolução dos aliases acontece por requisição: sem backend,
o servidor estático inicia, mas as rotas de API retornam erro de gateway, sem
fallback SPA. O healthcheck verifica somente o servidor estático.
A porta pode ser sobrescrita para diagnóstico com `FRONTEND_PORT`, mas o padrão
suportado é 5173; ajuste também `PUBLIC_BASE_URL` se compartilhar pesquisas
usando outra porta.

`ORGANIZER_UPSTREAM` e `SURVEY_UPSTREAM` permitem trocar as origens do Nginx por
HTTP(S), sem caminho, barra final ou credenciais. Os padrões são os aliases da
tabela. `API_UPSTREAM` é mantido para compatibilidade com API unificada/BFF;
para usar esse fallback, defina explicitamente os outros dois upstreams como
vazios via override Compose. Essas variáveis não alteram o Vite.

Para parar somente o frontend:

```bash
docker compose down
```

## Validação

```bash
npm ci
npm run typecheck
npm test
npm run build
node scripts/verify-proxies.mjs vite
```

O último comando inicia upstreams **sintéticos** em 8080/8087 e o Vite em 5173;
execute apenas em um ambiente isolado com essas três portas livres. Ele verifica
as rotas de login/logout, eventos, publicação, pesquisa/resposta e comentários,
incluindo método/corpo, cookies múltiplos, header CSRF, Host/Origin, query strings,
status de sucesso/erro, redirects e isolamento entre API e fallback SPA.
Não valida credenciais, autorização, persistência ou regras dos serviços reais.

Para repetir o teste Nginx em containers isolados, sem usar portas do host:

```bash
docker build -t event-feedback-frontend:proxy-test .
docker network create --internal ef-frontend-proxy-test
docker run -d --name ef-proxy-fixtures --network ef-frontend-proxy-test --network-alias ef-organizer --network-alias ef-survey -v "$PWD:/app:ro" -w /app node:22-alpine node scripts/verify-proxies.mjs fixtures
docker run -d --name ef-proxy-nginx --network ef-frontend-proxy-test --network-alias frontend -e ORGANIZER_UPSTREAM=http://ef-organizer:8080 -e SURVEY_UPSTREAM=http://ef-survey:8087 event-feedback-frontend:proxy-test
# Aguarde o healthcheck antes do teste:
docker inspect --format '{{.State.Health.Status}}' ef-proxy-nginx
docker run --rm --network ef-frontend-proxy-test -v "$PWD:/app:ro" -w /app node:22-alpine node scripts/verify-proxies.mjs http://frontend:8080
docker rm -f ef-proxy-nginx ef-proxy-fixtures
docker network rm ef-frontend-proxy-test
```

Com backend real disponível e dados de teste autorizados, valide **em cada modo**:
login, sessão após recarga, listagem/criação de evento com telefone sintético,
publicação, abertura/recarga de `publicUrl` em janela anônima, resposta às
perguntas, confirmação e logout. No painel Network, todas as chamadas devem
usar a origem 5173 e `/api/...`; confira cookies/CSRF sem compartilhar valores.
Erros 401/403/404/409/429/5xx devem manter seu status e não conter a SPA.

**Limitação preexistente:** o Survey Micronaut ainda não implementa
`GET /api/events/{id}/results` e `GET /api/events/{id}/results/comments`.
A tela existente apresenta erro até esses contratos serem disponibilizados;
o proxy não inventa resultados. Testes com mocks ou upstreams sintéticos não
comprovam integração ponta a ponta. Veja o registro desta tarefa em
[docs/validation.md](docs/validation.md).

## Vercel futura (sem deploy nesta tarefa)

O arquivo [docs/vercel.json.example](docs/vercel.json.example) prepara rewrites
HTTPS para Organizer e Survey, preservando `/api/...`, incluindo `/api/events`
sem sufixo. Substitua os domínios `*.example.com` por origens HTTPS reais e só
então copie para `vercel.json` na raiz. Não há configuração ativa de deploy
nesta tarefa. Use Node **22.x**, preset **Vite**, instalação `npm ci`, build
`npm run build` e saída `dist`.

As regras de API precedem o fallback SPA, que exclui `/api` e `/api/*`.
Rotas desconhecidas ficam com 404 da plataforma; nunca com `index.html`.
Rewrites externos mantêm o domínio do frontend no navegador, ao contrário de
redirects. O exemplo desabilita cache das APIs, inclusive no CDN. Consulte
[rewrites externos e cache](https://vercel.com/docs/routing/rewrites) e
[configuração do projeto](https://vercel.com/docs/project-configuration/vercel-json).

Antes de ativar, os backends precisam estar acessíveis por HTTPS a partir da
Vercel (aliases Docker e localhost não são acessíveis). Configure
`SESSION_COOKIE_SECURE=true`, cookies de sessão `HttpOnly`, `SameSite=Lax`,
`Path=/` e sem `Domain` interno; o cookie CSRF legível deve continuar funcionando.
As APIs devem responder sem redirecionamentos para hosts internos, emitir
`Cache-Control: no-store` para dados privados e usar o `PUBLIC_BASE_URL` do
domínio publicado. Valide cookies, query strings, headers, erros de API,
login/logout e o fluxo público em preview antes de liberar. Esta preparação não
foi validada na infraestrutura Vercel e não altera backend, DNS ou VPS.

`node_modules/`, `dist/`, cobertura, `.env*`, chaves e configurações locais estão
ignorados pelo Git. Orientações de desenvolvimento:
[workspace/skill/dev.md](workspace/skill/dev.md).
