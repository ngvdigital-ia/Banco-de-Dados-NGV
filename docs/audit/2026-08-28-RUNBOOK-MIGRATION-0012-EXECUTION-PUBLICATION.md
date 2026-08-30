# Runbook — migration 0012 · execução e publicação

> Estado: **APLICADA E VALIDADA NO NEON EM 2026-08-28**. As migrations 0011 e
> 0012 foram aplicadas manualmente, em ordem, e validadas por readback no Neon
> alvo. A tabela `operation_offer_build_jobs` estava vazia no readback final,
> as flags permaneceram desligadas e nenhuma ativação externa foi realizada.
> Este documento preserva a sequência de preflight, readback e rollback como
> referência histórica; não autoriza nova execução. Não usar
> `drizzle-kit migrate`, `drizzle-kit push` nem reaplicar as migrations já
> aplicadas.

## O que foi aplicado

`drizzle/0012_operation_offer_build_jobs.sql` cria dois enums e a tabela
`public.operation_offer_build_jobs`. A tabela é um recibo local sanitizado do
outbox de construção de ofertas. O Banco não executa n8n e não recebe o
payload que o workflow executará.

| Objeto | Função | Estado validado em 2026-08-28 |
| --- | --- | --- |
| `operation_offer_build_outbox_state` | estados locais do recibo | migration 0012 aplicada manualmente e validada no Neon |
| `operation_offer_build_failure_code` | códigos fechados de falha | migration 0012 aplicada manualmente e validada no Neon |
| `operation_offer_build_jobs` | recibo por job, com CAS no adapter | criada e vazia no readback final |

As migrations 0011 e 0012 foram aplicadas manualmente em ordem e validadas no
Neon em 2026-08-28. A migration 0010 foi somente validada e não foi
reaplicada. Não usar `drizzle-kit migrate`, `drizzle-kit push` nem reaplicar
0011/0012.

Os campos que podem chegar à projeção são oferta canônica, vínculo opcional
com `offer_tracking`, tipo `tracking`/`embed`, alvo lógico, estado, tentativas,
código fechado de falha e timestamps. A lista/projeção agregada nunca
seleciona/renderiza o hash completo do job. A possibilidade de uma
estação/API autenticada devolver o `job_id_sha256` opaco somente para
consultar o próprio job é contrato futuro, permitido apenas após
implementação e ativação separadas do endpoint/bridge correspondente, sob
Clerk operator + recibo local/identidade da oferta. Neste release não existe
endpoint de execução/status; o identificador não é Bearer nem segredo.
Payload, URL, credencial, PII e erro remoto bruto ficam fora do recibo público.

O módulo de publicação é independente: reutiliza `offer_tracking.site_urls`
para informar registro local de endereços. Ele não declara deploy, DNS, SSL ou
domínio online; a verificação externa permanece `PENDING`.

## Verdades e limites atuais

- **CONFIRMADO localmente:** Banco NGV usa Neon/Drizzle; Clerk é a identidade
  do dashboard; os módulos exigem a allowlist de operador; as flags de execução
  e publicação são server-side e default-off.
- **CONFIRMADO em produção:** as migrations 0011 e 0012 foram aplicadas
  manualmente e validadas no Neon em 2026-08-28; a tabela
  `operation_offer_build_jobs` estava vazia no readback final e as flags
  estavam desligadas.
- **CONFIRMADO localmente:** recibos usam contrato estrito, seleção allowlisted
  e atualização CAS; a lista/projeção agregada nunca seleciona/renderiza o hash
  completo do job nem payload. Neste release não existe endpoint de
  execução/status. A possibilidade de devolver o `job_id_sha256` opaco do
  próprio job é contrato futuro, permitido somente após implementação e
  ativação separadas de endpoint/bridge, sob Clerk operator + recibo
  local/identidade da oferta; ele não é Bearer nem segredo.
- **EXTERNAL_UNVERIFIED:** n8n, suas execuções/status, Vercel, deploy, DNS e
  SSL. Nenhum deles é inferido pelo fato de o código local existir.
- **Sem alteração:** o resumo do Core continua reunindo sete fontes: Banco NGV,
  Apps Ofertas, Cursos, Quiz, Spy, NexFy e Monitoramento NGV. Estas migrations
  não criam uma oitava fonte nem alteram a autoridade desses produtores.
- **Pendente operacional:** há credenciais locais antigas detectadas; rotação
  necessária antes de ativar integrações. Não registrar caminho, token ou valor.
- **Pendente operacional:** nenhuma ativação externa foi realizada; as flags
  continuam desligadas.

`module_action_log` é anterior a esta migration e já possui
`actor_clerk_id`/`actor_email` para responsabilização. A política de finalidade,
retenção, acesso e expurgo está **PENDING** de aprovação e é gate antes de
ativar ações reais; nenhum prazo de retenção é presumido neste documento.
`logModuleAction` é best-effort: falha de auditoria não pode transformar um
enqueue já aceito em mutação repetida. `operation_offer_build_jobs` é o recibo
durável do job, mas a atribuição do ator pode faltar. Política, monitoramento e
reconciliação do audit trail são gate externo **PENDING**.

## Preflight local antes da janela (referência histórica)

1. Confirmar `pwd` no workspace Linux canônico e conferir o status do repositório
   sem limpar alterações preexistentes.
2. Ler novamente `drizzle/meta/_journal.json` e confirmar que 0012 é o último
   item local. Qualquer migration posterior exige novo runbook.
3. Conferir o hash/arquivo da migration 0012 contra a revisão aprovada. Não
   editar o SQL na janela sem novo preflight.
4. Confirmar, no dashboard, que o projeto Neon é o Banco NGV. Nunca usar a
   cópia do Windows, outro banco ou credencial de n8n/Vercel.
5. Manter todas as flags abaixo `false`/ausentes durante migration e readback:
   `OPERATION_EXECUTION_MODULE_ENABLED`,
   `OPERATION_DEPLOYMENT_DOMAINS_MODULE_ENABLED`,
   `OPERATION_OFFER_BUILD_ENABLED`,
   `OPERATION_OFFER_BUILD_STATUS_ENABLED`,
   `OPERATION_COMMANDS_ENABLED`,
   `OPERATION_COMMAND_DISPATCH_ENABLED` e
   `OPERATION_COMMAND_STATUS_ENABLED`.

## Readback SQL obrigatório (referência histórica)

Executar somente `SELECT`s antes e depois da migration. O exemplo abaixo
consulta metadados e agregados: não seleciona `job_id_hash`, `result`, payload,
URL ou qualquer texto de erro bruto.

### 1. Enums

```sql
SELECT
  n.nspname AS schema_name,
  t.typname AS enum_name,
  e.enumsortorder,
  e.enumlabel
FROM pg_type AS t
JOIN pg_namespace AS n ON n.oid = t.typnamespace
JOIN pg_enum AS e ON e.enumtypid = t.oid
WHERE n.nspname = 'public'
  AND t.typname IN (
    'operation_offer_build_outbox_state',
    'operation_offer_build_failure_code'
  )
ORDER BY t.typname, e.enumsortorder;
```

Esperado: estados `queued`, `leased`, `running`, `ready_for_review`,
`waiting_human`, `failed`, `completed`; falhas `INVALID_LEASE`,
`INVALID_PAYLOAD`, `HEARTBEAT_STALE`, `EXECUTION_REJECTED`, `RESULT_TOO_LARGE`,
`TRANSPORT_ERROR`, `INTERNAL_ERROR`.

### 2. Colunas, tipos, nulabilidade e defaults

```sql
SELECT
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_schema,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'operation_offer_build_jobs'
ORDER BY ordinal_position;
```

O shape esperado é: `id` serial/`integer` não nulo e chave primária;
`job_id_hash`, `offer_id`, `kind`, `target_key`, `outbox_state`, `attempts`,
`max_attempts`, `lease_generation`, `last_read_at`, `created_at` e `updated_at`
não nulos; `offer_tracking_id`, `lease_until`, `result`, `failure_code`,
`remote_updated_at` e `completed_at` nulos. `outbox_state` e `failure_code`
devem apontar aos enums desta migration; `result` deve ser `jsonb`.

### 3. Constraints e chave estrangeira

```sql
SELECT
  ns.nspname AS schema_name,
  rel.relname AS table_name,
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint AS con
JOIN pg_class AS rel ON rel.oid = con.conrelid
JOIN pg_namespace AS ns ON ns.oid = rel.relnamespace
WHERE ns.nspname = 'public'
  AND rel.relname = 'operation_offer_build_jobs'
ORDER BY con.contype, con.conname;
```

```sql
SELECT
  con.conname,
  child.relname AS child_table,
  child_attr.attname AS child_column,
  parent.relname AS parent_table,
  parent_attr.attname AS parent_column,
  pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint AS con
JOIN pg_class AS child ON child.oid = con.conrelid
JOIN pg_class AS parent ON parent.oid = con.confrelid
JOIN pg_attribute AS child_attr
  ON child_attr.attrelid = child.oid AND child_attr.attnum = con.conkey[1]
JOIN pg_attribute AS parent_attr
  ON parent_attr.attrelid = parent.oid AND parent_attr.attnum = con.confkey[1]
JOIN pg_namespace AS child_ns ON child_ns.oid = child.relnamespace
WHERE child_ns.nspname = 'public'
  AND child.relname = 'operation_offer_build_jobs'
  AND con.contype = 'f'
ORDER BY con.conname;
```

Esperado: primary key em `id`, unique e check constraints da migration, e uma
FK de `offer_tracking_id` para `public.offer_tracking(id)` com `ON DELETE
RESTRICT`. A definição efetiva retornada pelo PostgreSQL é a autoridade; o
nome da FK pode ser truncado pelo limite de 63 bytes do PostgreSQL, como
registrado no relatório produtivo. Se a definição efetiva divergir do SQL
local, parar e revisar; não exigir um identificador nominal maior que o limite.

### 4. Índices

```sql
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'operation_offer_build_jobs'
ORDER BY indexname;
```

Esperado: índice da PK/unique de `job_id_hash` e os índices de
`offer_id`, `offer_tracking_id`, `outbox_state` e `remote_updated_at`. Não
criar índice manual fora da migration durante este runbook.

### 5. Contagem e amostra agregada sem hash/payload

```sql
SELECT COUNT(*) AS total_jobs
FROM public.operation_offer_build_jobs;

SELECT
  outbox_state,
  kind,
  COUNT(*) AS jobs,
  COUNT(*) FILTER (WHERE result IS NOT NULL) AS jobs_with_result,
  MAX(last_read_at) AS latest_local_read
FROM public.operation_offer_build_jobs
GROUP BY outbox_state, kind
ORDER BY outbox_state, kind;
```

O readback de 2026-08-28 registrou `0` jobs. Um novo readback pode registrar
contagens e o timestamp agregado, mas nunca copiar hash, `result`, payload,
URL, credencial ou mensagem de erro para este arquivo. Se houver linhas em uma
futura janela, elas precisam ser explicadas e preservadas; não são motivo para
apagar a tabela automaticamente.

### 6. Dependências para rollback

```sql
SELECT
  pg_describe_object(dependency.classid, dependency.objid, dependency.objsubid)
    AS dependent_object,
  pg_describe_object(
    dependency.refclassid,
    dependency.refobjid,
    dependency.refobjsubid
  ) AS referenced_object
FROM pg_depend AS dependency
WHERE dependency.refclassid = 'pg_class'::regclass
  AND dependency.refobjid = 'public.operation_offer_build_jobs'::regclass
ORDER BY dependent_object;
```

Esta consulta serve para detectar consumidores antes de qualquer rollback; não
é autorização para removê-los.

## Sequência executada em 2026-08-28

A janela foi conduzida serialmente, parando no primeiro readback divergente.
As migrations 0011 e 0012 foram aplicadas manualmente e validadas no Neon;
elas não devem ser reaplicadas.

1. **Migration:** confirmou-se o projeto/banco alvo, a revisão do SQL e a
   autorização; 0011 e 0012 foram aplicadas manualmente em transação
   controlada. Não foi usado `drizzle-kit migrate` ou `drizzle-kit push`.
2. **Readback:** foram conferidos enums, colunas, constraints, FK, índices,
   contagem e dependências. A tabela de jobs ficou vazia no readback final.
3. **Flags falsas:** execução, publicação, intake, status, comandos e dispatch
   permaneceram desligados.
4. **Gate final:** a FK foi validada pela definição efetiva; o nome foi
   truncado de forma determinística pelo limite de 63 bytes do PostgreSQL e o
   achado foi classificado como baixo/cosmético. Não houve retry, rename,
   rollback, ativação de flag, deploy ou escrita adicional.
5. **Ativação externa:** não realizada. n8n, Vercel, DNS e SSL continuam
   `EXTERNAL_UNVERIFIED`; a publicação fica `PENDING` até readback autenticado.

## Rollback manual pré-ativação (referência histórica; não executar sem nova autorização)

Rollback é manual, externo, reversível somente antes do uso e nunca deve ser
acionado por falha de uma tela. Só considerar se **todas** as condições forem
verdadeiras:

- `COUNT(*)` da tabela é `0`;
- a tabela não tem dependentes/consumidores no readback;
- nenhuma flag foi habilitada para tráfego real;
- não houve recibo, auditoria ou integração que dependa da estrutura;
- há autorização explícita e uma nova leitura do estado imediatamente antes.

Se qualquer condição falhar, **não fazer rollback destrutivo**. Desabilitar as
flags, preservar a tabela e abrir correção/forward migration.

Quando os checks acima forem satisfeitos, a ordem é tabela antes dos enums:

```sql
BEGIN;

DROP TABLE public.operation_offer_build_jobs;
DROP TYPE public.operation_offer_build_outbox_state;
DROP TYPE public.operation_offer_build_failure_code;

COMMIT;
```

Se qualquer statement falhar, fazer `ROLLBACK` e parar. Nunca remover enums
antes da tabela, nunca dropar `offer_tracking` e nunca remover o ledger
Drizzle. Depois, repetir o readback de ausência em `pg_class`, `pg_type` e
`information_schema.columns`.

Depois de qualquer uso real, o rollback acima fica proibido: a mitigação é
desligar flags e manter evidência. A correção passa a ser compatível e aditiva.

## Gates de ativação

- migrations 0011/0012 aplicadas e validadas no Neon, sem reaplicação;
- `npm test`, typecheck sem gerar artefato no workspace e lint dos alvos em
  `PASS`;
- revisão de segurança: Clerk/operator, secrets server-only, sem hash/payload
  no browser, sem CORS novo e sem PII desnecessária;
- política de finalidade, retenção, acesso e expurgo de `module_action_log`
  aprovada;
- n8n e Vercel comprovados externamente, com URLs/segredos allowlisted e
  status sanitizado;
- smoke do módulo com flag falsa, usuário não operador, tabela ausente,
  recibo inválido, estado atrasado e erro remoto;
- nenhuma ativação externa é implícita por este documento;
- nenhum deploy, migration, DNS, push ou commit adicional é implícito por este
  documento.

## Estado deste corte

As migrations 0011 e 0012 estão **aplicadas e validadas no Neon em
2026-08-28**. O readback final confirmou a tabela
`operation_offer_build_jobs` vazia; as flags permanecem desligadas e nenhuma
ativação externa foi realizada. O próximo passo seguro é um novo gate explícito
de ativação externa, com readback e autorização próprios; não reaplicar as
migrations nem inferir que o código local prova n8n, Vercel, DNS ou SSL.
