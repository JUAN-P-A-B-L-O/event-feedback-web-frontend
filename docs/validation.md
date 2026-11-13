# Validação do ponto único de entrada

Executada em 12/11/2026, a partir de `origin/main` (`ed342fc`).
A implementação React, a interface e os clientes com URLs relativas foram
preservados. Não houve alteração do repositório backend, da VPS ou deploy.

| Verificação | Resultado |
| --- | --- |
| `npm ci` em `node:22-alpine` (Node 22.23.2) | Passou |
| `npm run typecheck` | Passou |
| `npm test` | 19 testes em 5 arquivos passaram; APIs mockadas |
| `npm run build` | Passou |
| `node scripts/verify-proxies.mjs vite` | Passou com upstreams sintéticos; inclui conflito de porta 5173 |
| `docker compose config --quiet` | Passou |
| Inspeção seletiva do Compose | Porta padrão 5173 e rede externa `event-feedback-dev` confirmadas |
| Build e `docker compose up --build -d --wait` isolado | Passou; frontend saudável |
| `nginx -t` no container | Passou |
| `node scripts/verify-proxies.mjs http://frontend:8080` | Passou contra o Nginx real e upstreams sintéticos |
| Mesmo teste com `--unavailable`, após remover os mocks | Passou; HTTP 502 JSON nas três famílias de API |
| `docs/vercel.json.example` | JSON válido, destinos HTTPS e exclusão de API no fallback conferidos estaticamente; sem deploy |
| `git diff --check` | Passou |

O teste HTTP exercitou caminhos de login, logout, sessão, listagem/criação de
eventos, publicação, pesquisa pública e resposta, além de query strings de
comentários. Verificou cookies múltiplos e seus atributos, header CSRF, Host e
Origin, métodos, corpos JSON/formulário, caminho codificado, query string,
redirecionamentos e status 201/204/400/401/403/404/409/429/500/502/503.
As rotas `/` e `/s/{token}` retornaram a SPA; `/api`, rotas desconhecidas e
prefixos semelhantes a rotas válidas não retornaram a SPA.
Isso comprova transporte/proxy, sem validar regras de negócio ou persistência.

Para executar as verificações com Node 22 sem trocar o Node 20 do host:

```bash
docker run --rm --user "$(id -u):$(id -g)" -e npm_config_cache=/tmp/npm-cache -v "$PWD:/app" -w /app node:22-alpine sh -c 'npm ci && npm run typecheck && npm test && npm run build && node scripts/verify-proxies.mjs vite'
```

O teste Compose usou o projeto temporário `ef-entry-validation`,
`FRONTEND_PORT=0` (porta efêmera) e uma sobreposição temporária que apontava a
rede externa para `ef-frontend-proxy-test`, criada com `--internal`.
Os upstreams padrão `ef-organizer:8080` e `ef-survey:8087` foram mantidos.
Isso evita interferir nos serviços existentes e não comprova a disponibilidade
da porta 5173 do host. Os containers e a rede temporários foram removidos ao
concluir; o frontend anterior em 15173 foi preservado.
Os comandos reproduzíveis do teste Nginx estão no README.

## Integração real pendente

Os containers Event Feedback encontrados estavam parados. A porta 5173 estava
ocupada pelo frontend de outro projeto e a 8080 pelo serviço de pagamentos de
outro projeto. Não foram interrompidos, alterados ou reutilizados nesses testes.
Não havia Organizer/Survey ativos nos aliases solicitados. Portanto, login real,
logout real, criação/publicação persistida e submissão real não foram validados
ponta a ponta. O README descreve a preparação e o roteiro para ambos os modos.

O Survey Micronaut consultado ainda não possui os endpoints de resultados e
comentários. A tela existente depende desses contratos e continuará apresentando
erro até sua implementação no backend. Não foi incluída implementação simulada
no produto para esconder essa limitação.

`npm audit` reportou três alertas nas dependências existentes: Vite (alto),
Vitest e `@vitest/mocker` (moderados). As versões dessas dependências foram
preservadas; a única dependência adicionada foi `@types/node` 22 para tipar o
middleware HTTP da configuração Vite. Não foi aplicado `npm audit fix --force`.
A avaliação/correção dos alertas permanece fora desta alteração de configuração.

Vercel: o exemplo fica inativo em `docs/`, com domínios HTTPS reservados para
documentação. Precisa de origens reais, configuração de cookies/CSRF e validação
em preview antes de uso. Nenhum comportamento de infraestrutura Vercel foi
testado nesta tarefa.
