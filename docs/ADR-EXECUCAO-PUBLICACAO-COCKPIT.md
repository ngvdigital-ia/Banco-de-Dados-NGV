# ADR — módulos de execução e publicação no cockpit

- **Status:** aceito; migrations 0011/0012 aplicadas e validadas no Neon em 2026-08-28; ativação externa pendente
- **Data:** 2026-08-28
- **Escopo:** Banco NGV, `/sistemas/execucao` e `/sistemas/publicacao`

## Decisão

O Banco NGV terá duas projeções locais e somente leitura:

1. `execucao` lê `operation_offer_build_jobs`, migration 0012 aplicada
   manualmente e validada no Neon em 2026-08-28, quando a flag server-side
   estiver habilitada. Mostra somente o recibo sanitizado e estados locais;
   não executa n8n nem guarda payload. A lista/projeção agregada nunca
   seleciona/renderiza o hash completo do job. A possibilidade de uma
   estação/API autenticada devolver o `job_id_sha256` opaco somente para
   consultar o próprio job é contrato futuro, permitido apenas após
   implementação e ativação separadas do endpoint/bridge correspondente, sob
   Clerk operator + recibo local/identidade da oferta. Neste release não existe
   endpoint de execução/status; o identificador não é Bearer nem segredo. URL,
   PII e erro remoto bruto ficam fora da projeção.
2. `publicacao` deriva `offer_tracking.site_urls` e informa apenas o registro
   local de endereços por categoria. `REGISTERED` não significa deploy, DNS,
   SSL ou URL pública funcionando; a verificação externa fica `PENDING` até
   readback autenticado.

Ambos os módulos usam Clerk + allowlist de operador, falham fechados e ficam
desligados por padrão. O ClickUp, n8n, Vercel e as sete fontes do Core
continuam com suas próprias autoridades; o cockpit só projeta evidência
sanitizada. O runbook de aplicação e readback histórico é
[`docs/audit/2026-08-28-RUNBOOK-MIGRATION-0012-EXECUTION-PUBLICATION.md`](audit/2026-08-28-RUNBOOK-MIGRATION-0012-EXECUTION-PUBLICATION.md).

## Motivo

O cockpit precisa reunir acompanhamento operacional sem transformar a interface
em executor privilegiado ou em uma segunda fonte de verdade. A tabela de jobs
é um outbox/recibo local com contrato estrito e CAS; o readback produtivo de
2026-08-28 confirmou a tabela `operation_offer_build_jobs` vazia. Os endereços
de oferta já existem em `offer_tracking`. Reutilizar esses objetos reduz
duplicação e deixa explícito o que ainda depende de prova externa.

## Consequências e limites

- O painel pode mostrar “recibo local” sem prometer que o workflow terminou.
- O painel pode mostrar endereço registrado sem prometer que foi publicado.
- O n8n e a Vercel só entram no estado operacional depois de autenticação,
  allowlist de host e readback externo em janela autorizada.
- O deploy do Banco não aplica migration nem habilita flags automaticamente.
- As migrations 0011 e 0012 foram aplicadas manualmente e validadas no Neon em
  2026-08-28; não usar `drizzle-kit migrate`, `drizzle-kit push` nem reaplicar
  essas migrations.
- As flags de execução, publicação, intake, status, comandos e dispatch
  permanecem desligadas; nenhuma ativação externa foi realizada.
- A política de finalidade, retenção, acesso e expurgo do `module_action_log`
  continua PENDING e é gate para ações reais.
- `logModuleAction` é best-effort: sua falha não pode transformar um enqueue já
  aceito em mutação repetida. `operation_offer_build_jobs` é o recibo durável
  do job, mas a atribuição do ator pode faltar; política, monitoramento e
  reconciliação do audit trail são gate externo PENDING.
- Credenciais locais antigas foram detectadas; rotação é necessária antes da
  ativação externa, sem registrar valores ou caminhos.

## Reversão

Antes de qualquer uso real, rollback estrutural só é permitido com contagem
zero, nenhum consumidor e autorização explícita. A ordem é `DROP TABLE` antes
de `DROP TYPE`, conforme o runbook histórico. Depois de uso, não remover a
estrutura: desligar as flags, preservar os recibos e corrigir por mudança
aditiva.
