# Validação Docker e Micronaut local

Executada em 13/11/2026. Branch `fix/docker-compose-micronaut`, criada de
`origin/main` atualizada (`ed342fc`). Worktree de implementação:
`/tmp/event-feedback-frontend-compose-fix`.

## Diagnóstico

- O PR #2 estava aberto, sem merge. Seu commit `cc11886` estava na branch
  original `chore/frontend-single-entry-point`, mas não na main.
- A alteração local de `vite.config.ts` (Organizer no host em 18080) foi
  preservada na worktree original e não foi incluída nesta correção.
- O frontend antigo estava healthy em 15173, com upstreams vazios e rede
  própria; `/api/auth/me` retornava 503.
- Organizer em 18080 retornava 401 e Survey em 8087 retornava 404 para token
  inexistente. Ambos estavam na rede `event-feedback_default`, com aliases
  Compose `organizer-service` e `survey-service`.
- A rede `event-feedback-dev` e os aliases `ef-organizer`/`ef-survey` do PR #2
  não existiam. Foi utilizada a rede existente, sem modificar o backend nem
  adicionar conexões manuais. PostgreSQL já pertence à mesma rede.
- A porta 5173 estava livre em `ss -ltnp` e `docker ps` antes da recriação.

## Comandos e resultados

Na worktree de implementação:

```bash
docker compose config --quiet
docker compose up --build -d --no-deps --force-recreate --wait frontend
docker compose ps
docker compose exec -T frontend nginx -t
docker compose logs --since 5m --tail 30 frontend
```

Compose válido, imagem construída e container healthy, publicado somente em
`127.0.0.1:5173`. O Docker utilizou o builder clássico e avisou sobre a ausência
de buildx; o build terminou com sucesso. O Dockerfile existente não precisou
de alteração. O projeto Compose fixo substituiu o container antigo em 15173.

Requisições reais com `curl --max-time 10 -s -o /dev/null -w '%{http_code}\n'`:

| URL em `http://localhost:5173` | Status |
| --- | --- |
| `/` | 200 |
| `/s/codex-nonexistent-validation` | 200, fallback SPA |
| `/api/auth/me` | 401 sem sessão |
| `/api/events` | 401 sem sessão |
| `/api/public/surveys/codex-nonexistent-validation` | 404 do Survey |
| `/api/unknown` | 404, sem fallback SPA |

Dentro do frontend, `wget -S -O /dev/null` para
`http://organizer-service:8080/api/auth/me` e
`http://survey-service:8087/api/public/surveys/codex-nonexistent-validation`
resolveu os aliases Docker e recebeu respectivamente 401 e 404. Isso confirma
DNS e conectividade HTTP real com ambos os serviços.

`nginx -t` passou. Logs recentes do frontend mostraram inicialização normal e
status 200/401/404, sem erro de upstream. Nos últimos 10 minutos consultados,
os logs dos backends não continham novas linhas. Logging das rotas públicas
permaneceu desativado. Não foram impressos cookies ou credenciais.

Com Node 22.23.5:

```bash
npm ci --cache /tmp/ef-compose-npm-cache --no-audit --no-fund
npm run typecheck
npm test
npm run build
git diff --check
```

Todos passaram: 19 testes em 5 arquivos. A primeira instalação sob restrição
de rede falhou no npm; a repetição com acesso ao registry concluiu normalmente.
Nenhuma dependência ou lockfile foi alterado.

## Transporte isolado

O script reaproveita os cenários Nginx do PR #2, usando os aliases reais deste
Compose. Foram executados mocks e a mesma imagem Nginx em rede temporária
`--internal`, sem portas publicadas e sem conexão aos backends reais:

```bash
docker network create --internal ef-compose-proxy-validation
docker run -d --name ef-compose-proxy-fixtures --network ef-compose-proxy-validation --network-alias organizer-service --network-alias survey-service -v "$PWD/scripts:/checks:ro" node:22-alpine node /checks/verify-proxies.mjs fixtures
docker run -d --name ef-compose-proxy-nginx --network ef-compose-proxy-validation --network-alias frontend -e ORGANIZER_UPSTREAM=http://organizer-service:8080 -e SURVEY_UPSTREAM=http://survey-service:8087 event-feedback-web-frontend-frontend
docker run --rm --network ef-compose-proxy-validation -v "$PWD/scripts:/checks:ro" node:22-alpine node /checks/verify-proxies.mjs http://frontend:8080
docker rm -f ef-compose-proxy-fixtures
docker run --rm --network ef-compose-proxy-validation -v "$PWD/scripts:/checks:ro" node:22-alpine node /checks/verify-proxies.mjs http://frontend:8080 --unavailable
docker rm -f ef-compose-proxy-nginx
docker network rm ef-compose-proxy-validation
```

Ambas as verificações passaram. Cobertura: famílias de rotas, métodos, corpos,
cookies múltiplos, atributos de cookies, CSRF, Host/Origin, Content-Type,
queries, caminhos codificados, redirects, status das APIs e isolamento do
fallback SPA. A remoção dos mocks resultou em 502 JSON. Os recursos temporários
foram removidos após o teste.

## Limites

Não houve login autenticado, criação de eventos ou submissão de respostas.
Preservação do transporte de sessão/CSRF foi testada com dados sintéticos;
as verificações reais foram anônimas, sem escrita no banco. Não foram alteradas
configurações de cookies, chaves CSRF ou PUBLIC_BASE_URL do backend.

Organizer, Survey e PostgreSQL mantiveram seus IDs e horários de início.
FarmApp, Payment Lab, volumes e outros projetos não foram modificados.
Não houve bloqueio de rede: os aliases Compose existentes foram suficientes.
Vite e configuração de produção não fazem parte desta correção.
