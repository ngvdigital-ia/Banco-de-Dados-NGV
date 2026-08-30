# Banco NGV / Neon — lote produtivo 0009–0012

Data da janela: 2026-08-28T15:37:44Z
Estado terminal: **HALTED_AFTER_FINAL_READBACK**

## Escopo autorizado e alvo

Foi usado exclusivamente o workspace físico Linux
`/home/pedro_victor/dev/NGV_Digital/workspaces/Banco_de_dados_NGV` e a variável
de produção do projeto Vercel já vinculado. A conexão foi validada como Neon;
nenhuma URL, credencial, token ou payload foi registrada neste documento.

O worktree já estava sujo antes da janela e foi preservado. Não houve
`drizzle-kit migrate`, `drizzle-kit push`, baseline no journal, deploy, push ou
commit.

## B1–B5 — backup e preflight

| Gate | Resultado |
| --- | --- |
| B1 — alvo | PASS: Neon, banco `neondb`, PostgreSQL `170011` |
| B2 — flags | PASS: sete flags de execução/publicação/comandos estavam `false` ou ausentes e foram mantidas assim |
| B3 — ledger | PASS: `drizzle.__drizzle_migrations` tinha `0` entradas |
| B4 — export recuperável de escopo | PASS: snapshot privado modo `0600`, JSON parseável, `3671` bytes, SHA-256 `78d7e04be564ca846e1045ee87bf6a2bd0ef614b23406f3f2927c29e8b05aad3` |
| B5 — pré-condições | PASS: 0010 existente com shape/index esperado; 0009/0011/0012 ausentes; oferta 253 única e com identidade esperada |

O backup privado fica em `~/.local/share/ngv-backups/banco-neon/2026-08-28-batch-0009-0012/`.
Ele contém somente o export recuperável do escopo afetado e metadados de schema;
não deve ser versionado nem compartilhado em chat.

Hashes conferidos antes de escrever:

| Arquivo | SHA-256 |
| --- | --- |
| `0009_clean_paibok.sql` | `ca176e0aba1a7895a3153a14985ab955966ae40dff71c7afe78f5065ca4f3b80` |
| `0011_add_canonical_offer_id.sql` | `1a4b9fafe0a574214d2f4614f788d99d61e1154858536d0acb7c2045bf03b714` |
| `0012_operation_offer_build_jobs.sql` | `85f1dac798e919a9a38075ad82863dc79d7ef18d888a5e364841e33f6e6dcc69` |

## Execução serial

1. **0009** — COMMIT transacional de 8 statements. Readback PASS: dois enums
   com todos os labels, 14 colunas, 7 constraints, 6 índices e `0` comandos.
2. **0010** — somente validada; **não reaplicada**. As 10 colunas e o índice
   `module_action_log_module_idx` continuam presentes.
3. **0011** — COMMIT transacional de 3 statements. Readback PASS: coluna
   nullable `text`, check de slug, índice único parcial; antes do vínculo havia
   `0` IDs canônicos e nenhuma duplicata/formato inválido.
4. **CAS piloto** — PASS: uma única linha guardada por `id=253`, nome,
   domínio e quiz esperados foi vinculada a `ngv:bumbumflix`.
5. **0012** — COMMIT transacional de 8 statements.

## Gate final que interrompeu a janela

O readback final confirmou todas as propriedades abaixo:

- ambos os enums de 0012 e todos os seus labels;
- as 18 colunas esperadas;
- os 6 índices esperados;
- tabela de jobs vazia, ledger de comandos vazio e nenhum comando para o
  piloto;
- um único ID canônico, em formato válido, associado à oferta 253;
- todas as flags continuam desligadas.

Porém, o gate de comparação literal de nomes de constraints falhou em uma única
constraint FK. O SQL local declara o identificador com 65 caracteres:

`operation_offer_build_jobs_offer_tracking_id_offer_tracking_id_fk`

PostgreSQL limita identificadores a 63 caracteres e o banco o armazenou como:

`operation_offer_build_jobs_offer_tracking_id_offer_tracking_id_`

Isso é truncamento determinístico de identificador, não ausência da FK, mas o
runbook exige parar no primeiro readback divergente. Portanto nenhuma ação
externa posterior foi realizada: não houve retry, rename, rollback, ativação de
flag, deploy ou escrita adicional.

Qualquer continuidade exige uma decisão explícita: aceitar e registrar o nome
efetivo de 63 caracteres como expectativa do gate, ou aplicar uma migration
aditiva futura para renomear a constraint. A segunda opção não foi autorizada e
não é necessária para a integridade referencial observada.

## Verificação local após a interrupção

`node --test tests/offer-tracking-canonical-id-migration.test.mjs tests/operacao-command-migration.test.mjs src/lib/operacao/offer-build-job-contract.test.mjs src/lib/operacao/offer-build-job-store.test.mjs`

Resultado: **25/25 PASS**, exit code `0`.

## Estado seguro de saída

- As estruturas 0009, 0011 e 0012 foram criadas e as flags permanecem
  desligadas.
- A migration 0010 não foi reaplicada.
- O vínculo canônico de BumbumFlix foi feito uma vez via CAS e confirmado.
- Não há jobs nem comandos novos no banco.
- Não executar rollback destrutivo: há agora um vínculo canônico persistido.

## Reauditoria independente posterior

Uma reauditoria read-only no Neon validou a definição da constraint em vez de
comparar apenas seu identificador. O truncamento é comportamento nominal do
PostgreSQL e foi classificado como achado **baixo e cosmético**. A FK efetiva é
`FOREIGN KEY (offer_tracking_id) REFERENCES offer_tracking(id) ON DELETE
RESTRICT`, com `ON UPDATE NO ACTION`; portanto não há divergência funcional ou
de segurança e não é recomendado renomeá-la em produção.

Readbacks independentes confirmaram 0009, a existência única e o shape de 0010,
0011, o CAS único `253 -> ngv:bumbumflix`, 0012, ledger e tabela de jobs vazios,
e as sete flags ausentes/default-off. O backup permaneceu íntegro e privado.
Os gates direcionados ficaram verdes: 25/25 testes, ESLint do schema e
TypeScript sem incremental. O único `git diff --check` global não verde decorre
de sujeira preexistente fora do lote (`.gitignore` e aviso CRLF), preservada.

Conclusão operacional: o lote Banco/Neon autorizado está **aplicado e
validado**, com flags desligadas e sem deploy. O gate futuro deve validar a
definição, a tabela/coluna alvo e as ações da FK; não deve exigir um nome local
maior que o limite de 63 bytes do PostgreSQL nem editar a migration já aplicada.
