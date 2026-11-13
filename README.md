# Event Feedback Web Frontend

Frontend independente em React, TypeScript e Vite.

## Desenvolvimento local

Use Node 22.12 ou superior da linha 22 e npm:

```bash
npm ci
npm run dev
```

Acesse http://localhost:5173. O proxy do Vite preserva os caminhos e encaminha:

| Caminho | Serviço local |
| --- | --- |
| `/api/auth/*` | Organizer Service, `http://127.0.0.1:8080` |
| `/api/events` e `/api/events/*` | Survey Service, `http://127.0.0.1:8087` |
| `/api/public/*` | Survey Service, `http://127.0.0.1:8087` |

Os serviços devem estar em execução; este projeto não os inicia. As chamadas
usam URLs relativas e cookies de sessão (`credentials: 'same-origin'`). Antes
de cada POST, o cliente obtém `/api/auth/csrf` e envia `X-XSRF-TOKEN`; o login
envia formulário com `username` e `password`. Configure a mesma chave CSRF nos
dois serviços e cookies compatíveis com HTTP local ou HTTPS em produção.
Nenhuma chave do backend deve entrar no frontend ou em variáveis `VITE_*`.
O `PUBLIC_BASE_URL` do Survey Service deve apontar para a origem do frontend,
pois os links compartilhados usam o `publicUrl` retornado pela API.

```bash
npm run typecheck
npm test
npm run build
```

O build gera `dist/`; Vite em desenvolvimento e Nginx no Docker têm fallback
para `index.html`, incluindo acesso direto e recarga de `/s/{token}`.
Testes com mocks não comprovam integração real com sessão, serviços ou banco.

**Limitação do backend atual:** a tela de resultados já existe neste frontend,
mas o Survey Service Micronaut inspecionado ainda não implementa
`GET /api/events/{id}/results` e `GET /api/events/{id}/results/comments`.
Ela apresenta erro até esses contratos serem disponibilizados. Os contratos de
autenticação, eventos e pesquisa pública foram conferidos no código dos serviços;
a integração completa exige ambos disponíveis e uma sessão de teste autorizada.

## Executar com Docker Compose e backend Micronaut

O backend deve estar iniciado pelo seu próprio Compose. No ambiente local,
Organizer publica `127.0.0.1:18080` (8080 interna), Survey publica
`127.0.0.1:8087` e PostgreSQL publica `127.0.0.1:15432`. O frontend sobe
**somente seu container**, sem iniciar, recriar ou modificar backend e banco.
O navegador acessa exclusivamente **http://localhost:5173** e URLs relativas.

O frontend ingressa como consumidor na rede existente `event-feedback_default`,
gerenciada pelo Compose do backend. Os aliases de serviço `organizer-service`
e `survey-service` já são registrados automaticamente pelo Compose e persistem
após recriações. Não execute `docker network connect` nem fixe IPs de containers.
Não use `localhost:18080` como upstream dentro do Nginx: localhost seria o próprio
frontend. A porta publicada do Organizer não interfere na conexão interna.

| Rota | Upstream na rede Docker |
| --- | --- |
| `/api/auth` e `/api/auth/*` | `http://organizer-service:8080` |
| `/api/events` e `/api/events/*` | `http://survey-service:8087` |
| `/api/public` e `/api/public/*` | `http://survey-service:8087` |

Na pasta deste frontend, confira que 5173 está livre antes de iniciar/recriar:

```bash
ss -ltnp '( sport = :5173 )'
docker ps --format 'table {{.Names}}\t{{.Ports}}'
docker network inspect event-feedback_default --format '{{range .Containers}}{{.Name}} {{end}}'
docker compose config --quiet
docker compose up --build -d --no-deps --force-recreate --wait frontend
docker compose ps
```

Se 5173 estiver ocupada por outro processo, pare e identifique o responsável;
não encerre processos de outros projetos automaticamente. Em reinícios futuros,
ela pode pertencer ao próprio frontend. A publicação é fixa em
`127.0.0.1:5173:8080`; `FRONTEND_PORT` de configurações antigas não é utilizado.
O comando `up --build --force-recreate` substitui também o frontend antigo em
15173; `restart` sozinho não aplica novas portas, redes ou variáveis.
O campo `name: event-feedback-web-frontend` mantém o projeto Compose estável,
inclusive em worktrees, sem criar outra instância do frontend.

Se o backend usar outro nome de projeto/rede, configure `BACKEND_NETWORK` com o
nome da rede existente. `ORGANIZER_UPSTREAM` e `SURVEY_UPSTREAM` permitem ajustar
os aliases/portas internos, sem caminho, barra final ou credenciais. Não imprima
`.env` ou a configuração completa, pois overrides podem conter dados sensíveis.
Se a rede ou os aliases dos dois serviços não existirem, isso é um bloqueio de
configuração do backend: solicite a correção ao responsável. Não crie uma rede
vazia nem conecte containers manualmente para esconder o problema.

A rede existente também contém PostgreSQL. Este procedimento não muda suas
redes, volumes ou portas e não publica novos serviços. Uma rede exclusiva de
APIs exigiria configuração no Compose do backend e fica fora deste escopo.
O frontend não acessa diretamente o banco.

O Dockerfile usa Node 22 no build e Nginx sem root em 8080 internamente. O DNS
Docker é consultado por requisição, permitindo resolver novos containers após
recriações. Nginx preserva caminho, query strings, método, corpo, headers,
cookies de sessão e CSRF, sem reescrita de cookies. Erros das APIs mantêm status,
headers e corpo e nunca caem no fallback da SPA. O healthcheck cobre apenas os
arquivos estáticos; não comprova conexão com as APIs.

Valide de verdade, sem credenciais nem alterações de dados:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/
# 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/api/auth/me
# 401 sem sessão
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/api/public/surveys/nonexistent-validation-token
# 404 do Survey
docker compose exec -T frontend nginx -t
docker compose logs --since 5m --tail 30 frontend
```

Logs das pesquisas públicas permanecem desativados para preservar tokens e
privacidade. Para diagnosticar DNS/conexão, execute dentro do frontend:

```bash
docker compose exec -T frontend sh -c 'wget -S -O /dev/null http://organizer-service:8080/api/auth/me; wget -S -O /dev/null http://survey-service:8087/api/public/surveys/nonexistent-validation-token'
```

`wget` retorna erro para 401/404; os status esperados comprovam acesso ao serviço.
502/504 indicam falha de DNS/conexão/timeout; 503 retornado pela API precisa ser
diagnosticado no backend. Mantenha `PUBLIC_BASE_URL=http://localhost:5173` no
Survey e cookies compatíveis com HTTP local e a mesma chave CSRF nos serviços,
conforme o setup de segurança do backend. Essas configurações não são alteradas
por este frontend. Login e operações autenticadas exigem uma conta de teste.
`API_UPSTREAM` continua como fallback opcional; os upstreams de serviço têm
prioridade. Essas variáveis configuram o Nginx, não o proxy Vite.

Para parar somente o frontend, preservando a rede externa e os volumes:

```bash
docker compose stop frontend
```

Para testes e build, use Node 22 e os comandos da seção de desenvolvimento.
O script `scripts/verify-proxies.mjs` também pode verificar o transporte Nginx
com upstreams sintéticos **em uma rede isolada**, sem usar as portas dos backends
reais. Ele cobre cookies/CSRF, headers, métodos, corpo, queries, erros e fallback;
o modo `fixtures` deve ser executado somente nessa rede isolada, sem publicar portas.
O resultado da integração real está em [docs/docker-validation.md](docs/docker-validation.md).

## Publicação futura na Vercel

Importe este repositório com preset **Vite**, Node **22.x**, instalação `npm ci`,
build `npm run build` e diretório de saída `dist`. O proxy de desenvolvimento do
Vite não faz parte do build. Antes de publicar, configure rewrites de `/api/auth/*`
para a origem HTTPS do Organizer e de `/api/events`, `/api/events/*` e
`/api/public/*` para a origem HTTPS do Survey, preservando o caminho e os cookies.
Depois das regras de API e arquivos estáticos, configure o fallback da SPA para
`/index.html`, inclusive `/s/{token}`. Nunca encaminhe erros de API para HTML.

Mantenha as APIs na mesma origem vista pelo navegador, sem cache de sessão ou
respostas privadas, com cookies `Secure`, `HttpOnly` para a sessão e `SameSite=Lax`.
Atualize futuramente o `PUBLIC_BASE_URL` no backend para o domínio publicado e
valide login, logout, CSRF e recarga do link público antes de liberar o acesso.
Consulte [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite) e
[rewrites](https://vercel.com/docs/routing/rewrites). Esta tarefa não aplica
configurações nem faz deploy na Vercel.

`node_modules/`, `dist/`, cobertura, `.env*`, chaves e configurações locais estão
ignorados pelo Git. Não coloque credenciais em código nem na URL dos upstreams.

As orientações de desenvolvimento estão em [workspace/skill/dev.md](workspace/skill/dev.md).
