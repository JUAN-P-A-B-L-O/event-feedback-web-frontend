# Desenvolvimento do Event Feedback Frontend

Use este guia ao implementar, corrigir ou revisar este frontend. Trabalhe no
escopo solicitado e confirme o estado atual dos arquivos antes de aplicar as
convenções abaixo; caminhos e configuração podem evoluir.

## Antes de alterar

- Leia `AGENTS.md`, `README.md`, `package.json` e os arquivos da funcionalidade.
  Consulte documentação adicional se existir e for relevante.
- Confira a branch, o diff e arquivos não rastreados. Preserve trabalho local;
  não faça stash, reset, limpeza ou sobrescrita automática.
- Não implemente nem faça commits na `main`. Para trabalho novo, use uma branch
  própria; para continuação, reutilize a branch da tarefa. Não inclua arquivos
  preexistentes no commit só porque estão sem rastreamento.
- Este repositório é o frontend separado. Não trate `../event-feedback` como
  parte gravável desta tarefa nem retome migrações de backend por inferência.
  Consulte contratos do backend quando necessário, respeitando o escopo pedido.

## Estrutura e padrões atuais

- React 19, TypeScript estrito, Vite e npm com `package-lock.json`.
- `src/App.tsx`: sessão do organizador, login/logout e seleção da pesquisa
  pública por `/s/:token`. A navegação atual usa estado React e pathname;
  não introduza um roteador sem necessidade da tarefa.
- `src/Events.tsx`: lista, cadastro e detalhe dos eventos.
- `src/PublicSurvey.tsx`: preenchimento e envio da pesquisa pública.
- `src/SurveyLink.tsx`: apresentação e cópia do link público.
- `src/EventResults.tsx`: participação, avaliações, NPS e comentários paginados.
- `src/api/auth.ts` e `src/api/events.ts`: contratos tipados, chamadas HTTP,
  sessão, CSRF e erros. Acrescente operações nesta camada, evitando `fetch`
  espalhado pelos componentes.
- `src/styles.css`: estilos compartilhados, variáveis de cor/espaçamento e
  fonte local Nunito Sans. Reutilize a linguagem visual existente.
- Testes ficam junto dos componentes, em `src/*.test.tsx`, com Vitest,
  Testing Library e jsdom. Consulte um teste próximo antes de criar outro.

Prefira componentes funcionais, hooks e tipos explícitos nas fronteiras da API.
Mantenha código e contratos em inglês; textos de interface e documentação em
português. Evite `any`, supressões do compilador, dependências e abstrações sem
necessidade concreta. Não instale frameworks de UI, estado ou CSS para uma
alteração que os padrões atuais comportam.

## API, sessão e dados

- Preserve URLs relativas `/api/...` e `credentials: 'same-origin'`. A sessão
  atual usa cookies; não substitua por JWT nem armazene credenciais no navegador.
- Reutilize `csrfToken()` e o cabeçalho `X-XSRF-TOKEN` nas operações de escrita,
  conforme os clientes existentes. Não desative CSRF para resolver integração.
- Preserve `ApiError`, `PhoneListError` e o tratamento de sessão expirada.
  Diferencie erros de autorização, indisponibilidade e validação conforme o
  contrato real; não transforme toda falha em lista vazia ou sucesso.
- O backend decide autorização e isolamento por organização. Ocultar botões ou
  enviar `organizationId` não substitui autorização no servidor.
- Use `publicUrl` retornado pelo backend para compartilhar pesquisas. Não monte
  links com host, porta ou token inventados. Preserve a codificação de tokens
  nos caminhos das chamadas públicas.
- Preserve o significado de `null` nas métricas: ausência de dados não é zero.
  Não recalcule resultados no cliente com regras diferentes do backend.
- Comentários e outros textos externos devem ser renderizados como texto React.
  Não use `dangerouslySetInnerHTML` para exibi-los.
- Não registre senhas, cookies, tokens de pesquisa, telefones ou respostas de
  participantes. Use dados sintéticos nos testes e não leia ou imprima `.env`
  para explicar uma configuração.

## Comportamento de interface

Implemente os estados relevantes: carregando, vazio, sucesso, erro e envio em
andamento. Preserve campos quando o envio falhar, impeça submissões duplicadas
enquanto houver uma requisição pendente e permita nova tentativa quando cabível.
Ao trocar de evento ou desmontar um componente, impeça respostas antigas de
sobrescreverem a tela atual; revise efeitos e dependências quando mexer nesse fluxo.

Use HTML semântico, labels associados aos campos, botões acessíveis por teclado,
foco visível e mensagens com `role="alert"` ou `role="status"` conforme o caso.
Mantenha layouts utilizáveis a partir de 320 px, sem depender só de cor para
comunicar informação. Verifique desktop e celular quando houver alteração visual.

## Execução e integração

Execute na raiz do repositório:

```bash
npm ci                 # quando precisar instalar pelo lockfile
npm run dev            # Vite; /api/auth -> 8080; /api/events e /api/public -> 8087
npm run typecheck
npm test
npm run build          # inclui typecheck e gera dist/
```

Para um teste específico, use, por exemplo,
`npm test -- src/App.test.tsx`. Não há script de lint declarado atualmente;
não reporte lint como executado sem uma ferramenta configurada.

O Dockerfile compila com Node 22 e serve o build com Nginx sem root, na porta
8080. `docker compose up --build -d --wait` sobe somente o frontend, por padrão
em `http://localhost:15173` (`FRONTEND_PORT` altera a porta). `nginx.conf` é um
template processado na inicialização: `API_UPSTREAM` configura opcionalmente a
origem de uma API unificada, sem caminho nem barra final. `ORGANIZER_UPSTREAM`
e `SURVEY_UPSTREAM` permitem configurar os serviços separados e têm prioridade
nas respectivas rotas. Sem upstream configurado para uma rota, `/api/`
retorna 503 e os arquivos estáticos continuam disponíveis. A resolução do
hostname da API ocorre por requisição, sem bloquear a inicialização do Nginx.
Preserve o fallback da SPA, inclusive `/s/`, o tratamento de privacidade e o
limite de requisições das rotas públicas. O healthcheck cobre o servidor
estático; não comprova que sessão ou backend funcionam.

Não inclua `node_modules/`, `dist/` ou segredos em commits. Preserve o lockfile
e atualize-o apenas quando a tarefa mudar dependências. Não remova esses
diretórios ou altere configurações de outros projetos para limpar a entrega.

## Validação e entrega

- Para mudanças de comportamento, teste o fluxo afetado e riscos concretos:
  sessão expirada, falha seguida de nova tentativa, campos preservados,
  paginação ou troca de evento, conforme a alteração.
- Use mocks na fronteira HTTP/API e consultas por papel ou label. Não escreva
  testes que apenas repetem detalhes internos da implementação.
- Para código, rode testes relevantes e `npm run build`. Amplie os testes se
  houver impacto compartilhado. Para documentação apenas, revise conteúdo,
  links e diff; não execute build sem motivo.
- Testes com API mockada não comprovam integração com BFF, backend ou PostgreSQL.
  Só declare validação real se os serviços tiverem sido usados e o resultado
  tiver sido observado. Não use dados reais de participantes para isso.
- Revise o diff e relate o que mudou, verificações executadas e limitações.
  Não faça commit, push, PR, publicação ou merge sem a autorização correspondente.
  Uma autorização já dada continua válida dentro do mesmo escopo; não peça de
  novo. Aprovação de push ou PR não autoriza merge.
