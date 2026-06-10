# Cardápio de Features — Ideação 2026-06-10

> Workflow multi-agente: 8 lentes → 40 propostas brutas → curadoria/dedup (25 únicas) → verificação adversarial (25 aprovadas) → síntese.
> Pós-validação manual do orquestrador: 1 evidência inflada corrigida (pick 1 — ver nota ⚠️).
> Contexto de corte: a operação está sangrando (ROAS 0.64 na Conta Dólar 7d, reembolso ~24% no produto core) — features que mostram ONDE o dinheiro vaza e automatizam stop-loss valem mais que gestão/UX agora.

## TOP PICKS (6)

### 1º — P&L real: lucro diário blended + por campanha em /vendas — nota 8.5 | M | alto
- **Problema:** o ROAS visível usa revenue da UTMify (atribuição dela, bruta); o /vendas tem receita real mas sem gasto. Ninguém responde "fechamos o dia no verde?".
- **Proposta:** seção "Lucro real" em /vendas: (a) **lucro diário blended** = receita real aprovada (sale) − spend do dia (`utmify_campaign_daily`) − estornos → série na timeline existente + KPI "lucro do período" (zero join, 100% robusto); (b) detalhamento **por campanha** via matching por NOME (prefixo antes do `|` no utmCampaign da venda ≈ campaignName da UTMify, normalizado) — best-effort, com linha "(sem match)" explícita; ROAS real lado a lado com o ROAS UTMify pra expor a divergência (há campanha com ROAS UTMify ~11 e ZERO vendas reais).
- ⚠️ **Correção pós-validação:** o relatório original alegava join determinístico por ID Meta (`split_part(utmCampaign,'|',2)`) — **FALSO**: o `campaignName` da UTMify NÃO carrega o `|id` (verificado no banco: 0 matches). 263/263 vendas têm o ID Meta, mas o outro lado não. Por isso o blended é o núcleo e o por-campanha é por nome.
- **Limitação transversal:** `utmify_campaign_daily` cobre só a Conta em Dólar — exatamente a conta em crise, aceitável agora.

### 2º — Sentinela de campanha no motor de alertas: gasto sem retorno — nota 8 | S | alto
- **Problema:** o /alertas só vê agregado do dashboard; campanha individual queimando verba fica invisível.
- **Proposta:** métrica `campaign_roas` no motor existente: varre `utmify_campaign_daily` por campanha, dispara UM Slack listando ofensoras com spend > piso (ex. $50/7d) e ROAS < threshold. Valor da métrica = nº de ofensoras + detalhe multi-linha. ~4 arquivos, sem migration.
- **Caso real no banco:** '08/05-Teste-EN-Vspot' gastou $603 → $0 de receita; há caso atual (07-08/06) que já dispararia.

### 3º — Ranking de devolução por produto + alerta refund por produto — nota 8 | M | alto
- **Problema:** refund/chargeback é só KPI global; o produto core tem ~26,5% de devolução (26/98) — risco de bloqueio no gateway — diluído e invisível.
- **Proposta:** bloco "Devoluções por produto" em /vendas (contagem, valor, taxa; denominador mínimo ~10 transações) + métrica global `product_refund_rate` no alerts-eval que dispara um único Slack com os ofensores. Sem migration (NÃO criar scope 'product' em ALERT_TARGETS).

### 4º — Home viva: KPIs 7d com dado que atualiza (e conserta ROAS ERRADO) — nota 8.5 | S | alto
- **Problema (BUG confirmado):** a home lê `utmify_offer` (3 linhas paradas em 14/abr), "Projetos Recentes" lê tabela vazia, e `getMetricsTrend` (dashboard-actions.ts:191-205) agrega **SEM filtrar entity_type** — soma revenue de venda + campanha sobre spend só de campanha → o ROAS exibido é matematicamente errado.
- **Proposta:** hero com receita líquida 7d de `sale` + spend/revenue de `utmify_campaign_daily` rotulado "Conta em Dólar — UTMify"; "Top ofertas da semana" no lugar de projetos; filtro de entity_type no trend; label de defasagem do dado.
- **Por quê:** a tela mais vista mostrando ROAS errado em plena crise = risco ativo de decisão errada. Melhor custo/benefício da lista (S).

### 5º — Venda real por criativo (AD#): parse do utmContent — nota 8 | M | alto
- **Problema:** a atribuição para na campanha, mas `utmContent` carrega o anúncio exato (AD#, grupo) — ninguém lê esse campo.
- **Proposta (V1):** ranking por anúncio em /vendas: parse `split('|')[0]` + regex `AD\d+`/`G\d+` com normalização; quebra por status (aprovado/reembolso/chargeback; excluir precheckout); exibir o n por célula (mediana ~4 vendas/ad — decidir com o ruído à vista). Placar por editor/copy = fase 2 best-effort.
- **Dado:** 273/293 vendas com utmContent; 255 (87%) com padrão AD<n>; 57 ads distintos.
- **Por quê:** picks 1-2 dizem qual campanha cortar; este diz qual criativo cortar/escalar — a alavanca pra CONSERTAR o ROAS. Cruza com reembolso por anúncio.

### 6º — Central self-service de mapeamento oferta↔externo (matar o "Outros") — nota 8 | M | alto
- **Problema:** 162/175 linhas de campanha ($7.188) caem em "Outros"; nos últimos 14 dias, 100% do spend ($1.722) órfão; os 3 mapas hardcoded pararam em abril; só dev corrige.
- **Proposta:** tela admin listando órfãos (campanhas, products, players VTurb) com dropdown das 31 ofertas → grava em `external_mappings` (tabela existe, vazia); extractors consultam o banco antes do fallback; backfill do histórico; aviso semanal Slack de órfão com spend.
- **BLOCKER:** migration trocando o unique index pra `(platform, external_id)` (hoje permite 1 campanha por oferta) — gate db-agent, aplicar via Neon MCP (NUNCA drizzle-kit migrate); carregar o mapa 1x por execução de cron; backfill passa pelo review-agent.
- **Por quê:** fundação — destrava a precisão de todo analytics "por oferta" do backlog.

**Nota honesta:** a feature de maior nota (WIP por pessoa, 9) ficou FORA do top por critério de crise — é gestão de equipe, não estanca ROAS/reembolso. Primeira do backlog.

## BACKLOG (19 aprovadas fora do top)

| Feature | Essência | Esforço | Nota |
|---|---|---|---|
| Carga aberta (WIP) por pessoa | 2ª passada no cron ClickUp pra tasks abertas + vencidas em vermelho (34 vencidas invisíveis hoje) | M | 9 |
| Curva de retenção da VSL | `fetchUserEngagement` (pronto, nunca usado) on-demand + linha do pitch | M | 8 |
| Histórico/tendência de VSL + alerta de queda | Ler os 6.873 snapshots vturb_player (zero readers hoje) | M | 8 |
| Digests Slack diário + semanal W-vs-W | "Como foi ontem" ~12h30 UTC (dado UTMify materializa ~12h, não 4h!); avisar dia de 0 venda | M | 8 |
| Saúde dos agentes (erros n8n no dash + Slack) | listExecutions(status='error') + detecção de silêncio anômalo | S | 8 |
| Slack-reminder inteligente | Trocar texto estático por lista real de ofertas paradas 7d+ (12/14 hoje) | S | 8 |
| Evolução temporal da equipe | Série mês a mês de clickup_member (2.132 linhas, zero leitores) | S | 8 |
| Vendas por país | Geo de aprovação/refund/chargeback (customerCountry 293/293) | S | 7 |
| Drill-down de tarefas por pessoa + atrasos | Sheet com tasks reais por membro (31 atrasadas invisíveis) | M | 7 |
| Placar semanal do time no Slack | Ranking sexta à tarde via clickup_task | S | 7 |
| Idade na fila do kanban /agentes | Badge "sem atividade há X dias" + digest de paradas em "em ajustes" 3d+ | M | 7 |
| Busca global Ctrl+K | cmdk sobre ofertas/pessoas/rotas com deep-link | S | 7 |
| Offer-table em cards no mobile | View < md reusando calcProgress/STATUS_CYCLE | M | 7 |
| Página /offers/[id] | 360° da oferta; v1 só core (header+siteUrls+changelog) | L | 7 |
| Funil ponta-a-ponta da VSL | views→play→pitch→CTA→venda real; depende do mapeamento (pick 6) | M | 7 |
| Tendência diária por campanha (CTR/CPC) | Só Conta Dólar; volumes baixos = ruído; piso de significância | M | 6.5 |
| Telemetria persistente dos agentes | Camada de persistência agent_products (protege do prune n8n) | M | 6 |
| Re-execuções do Black no banco | Gravar 'reexecuted' após res.ok + corrigir approval-map | S | 6 |
| Linha do tempo de produção por oferta | Lead time por etapa via clickup_task (90d de retenção) | M | 6 |

## REPROVADAS
Nenhuma — mas a maioria foi aprovada COM AJUSTES obrigatórios (incorporados acima; vários corrigiam evidência inflada, denominador errado ou blocker de schema). A validação manual do orquestrador derrubou 1 evidência (join por ID Meta do pick 1).

## ONDAS SUGERIDAS

- **Onda 1 — Estancar o sangramento (2×S + 1×M, sem migration):** Sentinela de campanha + Home viva (conserta o ROAS errado) + Devolução por produto.
- **Onda 2 — Lucro real e alavancas (2×M, ambos em /vendas):** P&L real (blended + por campanha via nome) + Venda por criativo AD#.
- **Onda 3 — Fundação de atribuição (1×M com migration):** Central de mapeamento oferta↔externo. Depois dela, promover do backlog: WIP por pessoa (nota 9), curva de retenção, funil ponta-a-ponta.

Ondas 1 e 2 são independentes entre si e da 3. A única migration do plano está na Onda 3.
