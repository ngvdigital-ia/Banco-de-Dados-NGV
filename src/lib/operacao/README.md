# Snapshot da operação

`operation.snapshot.json` é a única fonte de dados da rota `/operacao`. Ele é versionado, sanitizado e validado com Zod no runtime. A leitura do snapshot não acessa `/home/pedro_victor/dev/NGV_Digital`, não usa variáveis de ambiente e não chama rede.

Regeneração local explícita:

```bash
node src/lib/operacao/generate-snapshot.mjs
node src/lib/operacao/generate-snapshot.mjs --check
```

Leitura live explícita (nunca executada pela rota):

```bash
node src/lib/operacao/refresh-live-status.mjs
```

O coletor chama somente `GET /api/v2/task/{id}` no ClickUp e `GET /api/v1/executions` no n8n
(`workflowId`, `limit=100`, `includeData=true`). Ele exige `N8N_BASE_URL`, `N8N_API_KEY` e
`N8N_OPERATION_WORKFLOW_ID`; para ClickUp prefere `CLICKUP_API_TOKEN` e aceita
`CLICKUP_API_KEY` como fallback local. O resultado é escrito atomicamente em
`operation.live.json`; a geração normal apenas lê e mescla esse artefato ao snapshot.
Não há busca por nome: somente os `task_id` explícitos do manifesto, incluindo `task_variants`,
são aceitos. No `runData` do n8n, apenas os nós allowlisted podem fornecer `task_id`.

O gerador aceita somente o hub real `/home/pedro_victor/dev/NGV_Digital` e o destino canônico deste diretório. Ele recusa outra origem/destino, chaves sensíveis, padrões de token, e-mails, identidades inválidas e eventos fora do contrato projetado. A gravação usa arquivo temporário e rename atômico.

Semântica conservadora:

- identidade ambígua ou bloqueio explícito → `BLOCKED`;
- ausência de evidência operacional → `PENDING`;
- evento local em andamento → `IN_MOTION`;
- `READY_FOR_REVIEW` somente com evidência de fase 7 explicitamente pronta;
- referência local a integração externa → fonte `UNVERIFIED`, nunca `OPERANT`.
- evidência live com mais de 12 horas → a fonte correspondente fica `DEGRADED`;
- falha de ClickUp ou n8n é isolada: a evidência sanitizada da outra fonte é preservada;
- eventos live são observações de cockpit na fase 1 e nunca alteram fase ou lifecycle da oferta.

O snapshot e o artefato live não incluem paths locais, IDs de tracking, URLs privadas, conteúdo de documentos, evidência bruta, e-mail ou segredo.

## Rollout reversível

A rota `/operacao` continua sendo um snapshot local, sem variáveis de ambiente próprias e sem chamadas de rede. Somente o controle de rollout usa a flag pública `NEXT_PUBLIC_OPERATION_COCKPIT_ENABLED`:

- `NEXT_PUBLIC_OPERATION_COCKPIT_ENABLED=true`: `/` redireciona para `/operacao` e a navegação exibe Operação.
- `NEXT_PUBLIC_OPERATION_COCKPIT_ENABLED=false` ou ausente: `/` e `/operacao` redirecionam para `/dashboard`; Operação fica oculta da navegação.

A visão geral anterior permanece sempre disponível em `/dashboard`. Para rollback, defina a flag como `false` (ou remova-a) e publique a configuração; não é necessário alterar snapshot, banco ou rede.
