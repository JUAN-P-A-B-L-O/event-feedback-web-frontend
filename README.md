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

## Executar com Docker

```bash
docker compose up --build -d --wait
```

Acesse http://localhost:15173. O Compose sobe somente o frontend, servido por
Nginx na porta interna 8080, sem iniciar backend ou banco. Para mudar a porta:

```bash
FRONTEND_PORT=15174 docker compose up --build -d --wait
```

Sem backend configurado, os arquivos e rotas da SPA são servidos normalmente;
requisições `/api/` retornam HTTP 503. A tela pode informar que não foi possível
carregar a sessão. Login, eventos e pesquisas precisam de uma API real.
O healthcheck verifica o servidor estático, não a saúde do backend.

Para serviços separados, configure origens HTTP ou HTTPS acessíveis a partir
do contêiner, sem caminho nem barra final:

```bash
ORGANIZER_UPSTREAM=https://organizer.example.com \
SURVEY_UPSTREAM=https://survey.example.com \
docker compose up --build -d --wait
```

Os caminhos `/api/...`, query strings e cookies são encaminhados pelo Nginx.
`localhost` dentro do contêiner aponta para ele próprio; um backend em outro
Compose precisa de uma rede compartilhada ou endereço acessível. O hostname da
API é resolvido ao receber requisições, permitindo iniciar o frontend mesmo
quando o backend estiver indisponível. Não coloque credenciais na URL.
`API_UPSTREAM` continua disponível como fallback opcional para uma API unificada
ou BFF; `ORGANIZER_UPSTREAM` e `SURVEY_UPSTREAM` têm prioridade nas suas rotas.
Essas variáveis configuram apenas o Nginx, não o Vite.

Para conferir o estado e parar somente este projeto:

```bash
docker compose ps
docker compose down
```

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
