# Propostas de melhorias para o Dashboard NGV

**Para:** aprovação da gestão
**Data:** 10/06/2026
**O que é isto:** levantamos tudo que o dashboard já coleta de dados e mapeamos 25 melhorias possíveis — todas usando informação que **já temos**, sem contratar nenhuma ferramenta nova. As 23 que envolvem decisão de negócio estão resumidas abaixo, em linguagem simples e separadas por área, para você marcar o que faz sentido (as outras 2 são ajustes técnicos internos, já documentados à parte).

**Como ler o tamanho de cada item:**
- 🟢 **Rápido** — questão de horas
- 🟡 **Médio** — 1 a 2 dias
- 🔴 **Grande** — 3 dias ou mais

**As marcadas com ⭐ são as que recomendamos fazer primeiro** — porque atacam diretamente o momento atual (estamos gastando mais em anúncio do que voltando em venda, e a taxa de devolução está alta).

---

## 💰 1. Vendas e Lucro — *enxergar onde o dinheiro entra e onde vaza*

### ⭐ 1.1 Lucro real do dia (P&L) — 🟡 Médio
**Hoje:** o dashboard mostra a receita das vendas e a ferramenta de anúncios mostra o gasto — mas ninguém vê os dois juntos. Não dá pra responder "fechamos o dia no verde ou no vermelho?".
**Proposta:** uma seção na página de Vendas mostrando, dia a dia: o que entrou (vendas reais), o que saiu (anúncios + devoluções) e **o lucro líquido**. Também por campanha, comparando o número "oficial" da ferramenta de anúncios com a venda que de fato caiu na conta — já encontramos campanha que a ferramenta diz que vendeu muito e na prática teve **zero** venda real.

### ⭐ 1.2 Devoluções por produto — 🟡 Médio
**Hoje:** só vemos a taxa de devolução geral (~24%). Isso esconde que **um produto sozinho está devolvendo 26,5%** — nesse nível, a processadora de pagamento pode bloquear a conta, o que pararia as vendas todas.
**Proposta:** tabela mostrando a devolução de cada produto + aviso automático no Slack quando algum produto passar do limite aceitável.

### 1.3 Qual anúncio realmente vende — 🟡 Médio
**Hoje:** sabemos qual *campanha* vendeu, mas não qual *criativo/anúncio*. Essa informação já chega junto com cada venda — só nunca foi usada (87% das vendas trazem o anúncio exato).
**Proposta:** ranking dos anúncios por venda real — e também por devolução (qual anúncio atrai cliente que pede reembolso). Ajuda a equipe a decidir qual criativo escalar e qual cortar.

### 1.4 Vendas por país — 🟢 Rápido
**Hoje:** cada venda registra o país do comprador, mas isso não aparece em lugar nenhum.
**Proposta:** quadro mostrando aprovação e devolução por país — útil pra decidir onde anunciar.

---

## 🚨 2. Avisos automáticos — *o dashboard avisa em vez de alguém precisar olhar*

### ⭐ 2.1 Alerta de campanha queimando dinheiro — 🟢 Rápido
**Hoje:** uma campanha pode gastar dias sem vender e ninguém percebe até abrir a ferramenta de anúncios. Exemplo real no nosso histórico: uma campanha gastou **$603 e vendeu $0**.
**Proposta:** o Slack avisa sozinho: *"a campanha X gastou $Y na semana e não retornou — vale revisar"*. Aproveita o sistema de alertas que já criamos.

### 2.2 Resumo diário no Slack ("como foi ontem") — 🟡 Médio
**Hoje:** pra saber como foi o dia, alguém precisa abrir o dashboard.
**Proposta:** toda manhã o Slack recebe um resumo automático: vendas, gasto, lucro, devoluções, comparativo com a semana anterior. Avisa inclusive quando o dia teve **zero** vendas.

### 2.3 Lembrete inteligente de ofertas paradas — 🟢 Rápido
**Hoje:** o lembrete diário do Slack é um texto fixo, genérico, que todo mundo ignora.
**Proposta:** trocar pelo dado real: *"estas ofertas estão sem atualização há mais de 7 dias: …"*. Hoje temos ofertas paradas há mais de 40 dias sem ninguém notar.

---

## 📊 3. Tela inicial — *correção importante*

### ⭐ 3.1 Tela inicial com números corretos e atuais — 🟢 Rápido
**Hoje:** encontramos um problema: **o indicador de ROAS da tela inicial está calculado errado** (mistura dados de fontes diferentes na mesma conta), e os destaques mostram informação parada desde abril. Ou seja: a primeira tela que todo mundo vê pode induzir decisão errada.
**Proposta:** corrigir o cálculo e trocar os destaques por: receita líquida dos últimos 7 dias, gasto em anúncios, e as ofertas que mais venderam na semana.

---

## 🎬 4. VSLs e Criativos — *entender o vídeo que vende*

### 4.1 Curva de retenção da VSL — 🟡 Médio
**Hoje:** sabemos quantas pessoas dão play, mas não **em que minuto o público abandona** o vídeo. Esse dado existe na ferramenta de vídeo e nunca foi puxado.
**Proposta:** gráfico mostrando a audiência ao longo do vídeo, com a marcação do momento do pitch — o copy e o editor enxergam exatamente onde a VSL perde as pessoas.

### 4.2 Evolução da VSL no tempo + alerta de queda — 🟡 Médio
**Hoje:** temos quase 7.000 medições diárias de performance das VSLs guardadas — e nenhuma tela mostra a evolução. Se uma VSL começa a piorar, ninguém vê.
**Proposta:** gráfico de tendência por VSL e aviso automático quando alguma despencar.

### 4.3 Funil completo da VSL — 🟡 Médio
**Proposta:** visão única: quantos viram a página → deram play → chegaram ao pitch → compraram. Mostra exatamente em que etapa cada oferta perde gente. *(Depende do item 7.1.)*

---

## 👥 5. Equipe e Produtividade — *gestão sem precisar perguntar*

### 5.1 Carga de trabalho por pessoa — 🟡 Médio ← *a melhor avaliada desta área*
**Hoje:** o dashboard mostra o que cada um **entregou**, mas não o que cada um **tem em mãos**. Não dá pra ver quem está sobrecarregado e quem pode pegar mais. Detectamos ainda **34 tarefas vencidas** que não aparecem em lugar nenhum.
**Proposta:** painel com as tarefas abertas de cada pessoa, destacando as atrasadas em vermelho.

### 5.2 Evolução da produtividade mês a mês — 🟢 Rápido
**Proposta:** gráfico da produção de cada pessoa ao longo dos meses (o dado já é coletado diariamente, só não é exibido).

### 5.3 Detalhe das tarefas e atrasos por pessoa — 🟡 Médio
**Proposta:** clicar no nome da pessoa e ver a lista real de tarefas dela, com os atrasos.

### 5.4 Placar semanal no Slack — 🟢 Rápido
**Proposta:** toda sexta, o Slack publica o ranking de entregas da semana. Reconhecimento automático.

### 5.5 Tempo de produção por etapa — 🟡 Médio
**Proposta:** medir quanto tempo cada oferta leva em cada fase (copy → edição → tradução → publicação) pra achar o gargalo do processo.

---

## 🤖 6. Agentes de IA — *vigiar os robôs que produzem*

### 6.1 Saúde dos agentes — 🟢 Rápido
**Hoje:** quando um agente de IA falha, o erro fica escondido no sistema técnico; descobrimos depois, do pior jeito.
**Proposta:** indicador no dashboard + aviso no Slack na hora em que um agente falhar ou ficar tempo demais em silêncio.

### 6.2 "Parado há X dias" no quadro dos agentes — 🟡 Médio
**Proposta:** etiqueta de tempo em cada card (ex: oferta esperando ajuste há 3+ dias) + resumo das paradas.

### 6.3 Histórico permanente do que os agentes produzem — 🟡 Médio
**Proposta:** guardar definitivamente cada produto gerado, aprovação e re-execução (hoje parte desse histórico se apaga sozinho com o tempo).

---

## 🧭 7. Organização e Facilidade de Uso

### 7.1 Central de classificação das campanhas — 🟡 Médio ← *destrava várias outras*
**Hoje:** **100% do gasto em anúncios dos últimos 14 dias está caindo como "Outros"** nos relatórios, porque a ligação campanha→oferta é feita manualmente em código e parou de ser atualizada. Resultado: os relatórios "por oferta" estão cegos, e só programador conseguia corrigir.
**Proposta:** tela onde qualquer admin liga a campanha nova à oferta certa em 2 cliques. Com isso, todos os relatórios por oferta passam a funcionar sozinhos.

### 7.2 Busca rápida (Ctrl+K) — 🟢 Rápido
**Proposta:** atalho pra buscar qualquer oferta ou pessoa de qualquer tela.

### 7.3 Versão para celular da tabela de ofertas — 🟡 Médio
**Proposta:** a tabela principal vira cards no celular (hoje exige rolagem lateral incômoda).

### 7.4 Página completa de cada oferta — 🔴 Grande
**Proposta:** um link único por oferta com tudo: status, domínios, histórico, números — útil pra compartilhar.

---

## ✅ Resumo para decisão

| # | Melhoria | Área | Tamanho | Recomendada |
|---|----------|------|---------|:----:|
| 1.1 | Lucro real do dia (P&L) | Vendas | 🟡 | ⭐ |
| 1.2 | Devoluções por produto + alerta | Vendas | 🟡 | ⭐ |
| 1.3 | Qual anúncio realmente vende | Vendas | 🟡 | |
| 1.4 | Vendas por país | Vendas | 🟢 | |
| 2.1 | Alerta de campanha queimando dinheiro | Avisos | 🟢 | ⭐ |
| 2.2 | Resumo diário no Slack | Avisos | 🟡 | |
| 2.3 | Lembrete inteligente de ofertas paradas | Avisos | 🟢 | |
| 3.1 | Tela inicial correta e atual | Tela inicial | 🟢 | ⭐ |
| 4.1 | Curva de retenção da VSL | VSL | 🟡 | |
| 4.2 | Evolução da VSL + alerta de queda | VSL | 🟡 | |
| 4.3 | Funil completo da VSL | VSL | 🟡 | |
| 5.1 | Carga de trabalho por pessoa | Equipe | 🟡 | |
| 5.2 | Produtividade mês a mês | Equipe | 🟢 | |
| 5.3 | Tarefas e atrasos por pessoa | Equipe | 🟡 | |
| 5.4 | Placar semanal no Slack | Equipe | 🟢 | |
| 5.5 | Tempo de produção por etapa | Equipe | 🟡 | |
| 6.1 | Saúde dos agentes de IA | Agentes | 🟢 | |
| 6.2 | "Parado há X dias" no quadro | Agentes | 🟡 | |
| 6.3 | Histórico permanente dos agentes | Agentes | 🟡 | |
| 7.1 | Central de classificação das campanhas | Organização | 🟡 | ⭐ |
| 7.2 | Busca rápida Ctrl+K | Facilidade | 🟢 | |
| 7.3 | Tabela de ofertas no celular | Facilidade | 🟡 | |
| 7.4 | Página completa de cada oferta | Facilidade | 🔴 | |

**Sugestão de sequência (se aprovar as ⭐):**
1. **Primeiro** (1 dia): alerta de campanha + tela inicial corrigida + devoluções por produto → *para de perder dinheiro sem saber*.
2. **Depois** (2-3 dias): lucro real + qual anúncio vende → *enxerga o lucro e o que cortar/escalar*.
3. **Por fim** (1-2 dias): central de classificação → *todos os relatórios por oferta passam a funcionar*.

*Qualquer combinação é possível — os itens são independentes entre si, salvo onde indicado.*
