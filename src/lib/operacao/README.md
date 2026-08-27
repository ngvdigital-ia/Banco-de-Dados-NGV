# Snapshot da operação

## Lista principal em runtime

`/operacao` consulta `offer_tracking` diretamente pelo Drizzle, em modo somente leitura, e mostra somente ofertas criadas nos últimos 30 dias. A consulta usa os campos operacionais já existentes, não cria endpoint e não executa escrita. A fase é o marco mais avançado comprovado: registro, copy, VTurb, site, produto, campanha ou validação. Neon continua a autoridade das ofertas, métricas, ledger e comandos ClickUp/Codex.

Como nem toda linha recente possui `offer_id` cross-sistema reconciliado, a rota exibe o identificador real `banco:<id>` e não inventa um `ngv:*`. Se a consulta falhar, a página identifica o Banco NGV como fonte afetada e não reutiliza dados históricos fora da janela.

## Artefato legado e conectores

`operation.snapshot.json` continua versionado, sanitizado e validado para o piloto de conectores, mas não alimenta mais a lista principal da rota nem define identidade, fase, bloqueio ou freshness em runtime. Sua leitura não acessa `/home/pedro_victor/dev/NGV_Digital`, não usa variáveis de ambiente e não chama rede.

## Saúde por fonte no Core

Quando `OPERATION_CORE_SOURCE_STATE_ENABLED=true`, a mesa acrescenta a saúde/freshness dos seis produtores que o Core já consolida: Banco NGV, Apps Ofertas, Cursos, Quiz, Spy e Nexfy. O adaptador é somente leitura, usa a resposta já validada de `operational-summary-read` e não cria uma segunda fonte de oferta. Fonte ausente permanece `UNVERIFIED`; freshness ausente também não vira `OPERANT`; stale vira `DEGRADED`.

O rollback é definir a flag como `false` ou removê-la. Isso apenas oculta a camada de saúde do Core: não muda o Neon, as fontes, o ledger, o n8n ou o ClickUp.

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

O `--check` tem dois modos seguros. Quando `operation.live.json` existe, compara integralmente
a projeção regenerada, inclusive o overlay live. Em clone limpo, onde o artefato mutável não é
versionado, desconta somente os campos de fonte e os tipos de evento live conhecidos antes de
comparar a projeção local determinística. Esse segundo modo valida a integridade do snapshot,
mas não afirma que a evidência externa persistida continua atual.

O gerador aceita somente o hub real `/home/pedro_victor/dev/NGV_Digital` e o destino canônico deste diretório. Ele recusa outra origem/destino, chaves sensíveis, padrões de token, e-mails, identidades inválidas e eventos fora do contrato projetado. A gravação usa arquivo temporário e rename atômico.

Semântica conservadora:

- pendência declarada no manifesto → blocker `PENDING`, sem reprovar a oferta;
- identidade ambígua ou evento operacional bloqueado no ledger → `BLOCKED`;
- ausência de evidência operacional → `PENDING`;
- evento local em andamento → `IN_MOTION`;
- `READY_FOR_REVIEW` somente com evidência de fase 7 explicitamente pronta;
- referência local a integração externa → fonte `UNVERIFIED`, nunca `OPERANT`.
- evidência live com mais de 12 horas → a fonte correspondente fica `DEGRADED`;
- falha de ClickUp ou n8n é isolada: a evidência sanitizada da outra fonte é preservada;
- eventos live são observações de cockpit na fase 1 e nunca alteram fase ou lifecycle da oferta.

O snapshot e o artefato live não incluem paths locais, IDs de tracking, URLs privadas, conteúdo de documentos, evidência bruta, e-mail ou segredo.

## Rollout reversível

A rota `/operacao` sempre consulta a janela local do Neon e, quando as flags server-side correspondentes estão habilitadas, pode exibir resumos externos validados. O controle de entrada usa a flag pública `NEXT_PUBLIC_OPERATION_COCKPIT_ENABLED`; a camada de saúde do Core usa a flag server-side `OPERATION_CORE_SOURCE_STATE_ENABLED`:

- `NEXT_PUBLIC_OPERATION_COCKPIT_ENABLED=true`: `/` redireciona para `/operacao` e a navegação exibe Operação.
- `NEXT_PUBLIC_OPERATION_COCKPIT_ENABLED=false` ou ausente: `/` e `/operacao` redirecionam para `/dashboard`; Operação fica oculta da navegação.
- `OPERATION_CORE_SOURCE_STATE_ENABLED=true`: acrescenta fontes Core normalizadas à saúde da mesa; `false` ou ausente mantém somente as fontes locais da leitura runtime.

A visão geral anterior permanece sempre disponível em `/dashboard`. Para rollback, defina a flag como `false` (ou remova-a) e publique a configuração; não é necessário alterar snapshot, banco ou rede.
