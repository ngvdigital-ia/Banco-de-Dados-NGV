# As 16 tabelas vazias do Banco NGV — inventário

**17/08/2026** · Levantamento **100% de leitura**. Nada foi apagado, alterado ou migrado —
decisão sua: *"só documentar, não mexer"*.

---

## A descoberta

**Nenhuma das 16 é tabela sem código.** Todas têm CRUD completo escrito: formulário, ação,
validação, tudo. O que falta não é código — **é a primeira linha**.

Duas telas inteiras, já prontas e já no menu lateral, estão apagadas porque uma tabela de
~8 linhas nunca foi preenchida.

É o mesmo padrão das correções de ontem à noite, pela quarta vez: **a capacidade existe e
nunca foi ligada.**

---

## As 4 que estão fazendo tela mentir hoje

### 1. `team_members` — a mais cara de todas

Uma tabela com os membros da equipe. Vazia. Consequências, todas medidas:

| Onde | O que o usuário vê |
|---|---|
| `/analytics/team` ("Performance de Editores") | "Nenhum membro ativo" — **o ranking inteiro já está implementado**, cruzando com `offer_tracking` que TEM dado. Falta só a lista de gente |
| `/dashboard`, KPI "Equipe" | **0**, ao lado de KPIs verdadeiros. O pior tipo de mentira: um zero convincente no meio de números certos |
| Filtros "Copywriter" e "Editor" em 4 telas | dropdown abre **sem nenhuma opção e sem nenhum aviso** |
| ⌘K, grupo "Pessoas" | nunca encontra ninguém |

É isso que explica as 492 consultas a uma tabela vazia: são 2 leituras por página de análise,
mais 1 por dashboard, mais 1 por busca.

**Custo de resolver: cadastrar a equipe.** Não tem código a escrever.

### 2. `projects` — a raiz de 7 das 16

| Onde | O que o usuário vê |
|---|---|
| `/analytics/offers` | "Nenhuma oferta cadastrada" **com botão que leva a outra tela vazia** — e a NGV tem ofertas, estão em `offer_tracking` |
| `/dashboard`, card "Projetos Recentes" | "Nenhum projeto cadastrado", logo abaixo do KPI "Projetos" que mostra o total real. **Mesma tela, dois números que se contradizem** |
| `/metrics` | select de projeto vazio → **a tela de lançamento manual de métrica é inoperável** |

**Mas atenção:** está vazia **por decisão registrada no próprio código**
(`src/app/(dashboard)/import/actions.ts:51`): *"a tabela `projects` está vazia por design —
dados reais vivem em offer_tracking"*.

Ou seja: **não é esquecimento, é uma escolha antiga que ninguém terminou de aplicar.** Ou as
telas param de ler `projects`, ou `projects` passa a ser preenchida. Hoje é o pior dos dois
mundos — a tela promete e não entrega.

### 3. `alerts` / `alert_history` — feature no menu, rotina rodando a vazio

`/alertas` promete *"Monitora ROAS, gasto e reembolso e avisa no Slack… Avaliado todo dia às
4h30"*. A rotina **roda todo dia**, lê **zero** regras e não avalia nada.

> Detalhe que importa: **a melhoria de "dado desatualizado" que fiz esta noite está instalada
> num caminho que hoje nunca é percorrido.** Ela só passa a valer quando existir a primeira
> regra de alerta.

### 4. `tags` — no menu lateral, sempre vazia

E o componente que ligaria tag a entidade (`src/components/entity-tags.tsx`) **nunca foi
renderizado em nenhuma página**.

---

## As inofensivas (ninguém chega nelas)

`funnels`, `funnel_nodes`, `order_bumps`, `vsls`, `creatives`, `campaigns` — têm leitores, mas
todos vivem dentro de `/projects/[id]`, que é **inalcançável** enquanto `projects` estiver
vazia. Nenhum usuário chega lá.

`ab_tests` / `ab_test_variants` — a rota existe mas **não está no menu nem no ⌘K**; só se chega
digitando a URL.

`campaign_creatives` — **a única 100% órfã**: nenhum arquivo do projeto a menciona.

`entity_tags` — o único leitor é o componente que nunca foi renderizado.

`operation_commands` — **vazia de propósito**: é registro de auditoria recém-criado, atrás de
duas chaves de ativação. **Não apagar.**

---

## Dois achados de brinde, fora do escopo

**1. Um webhook que não consegue inserir nem se for chamado.**
`POST /api/webhooks/google-sheets` insere em `creatives`, que exige um projeto existente — e
`projects` está vazia. Todo insert viola a restrição. **E o handler engole o erro e responde
`{ success: true, imported: 0 }` com HTTP 200.**

É exatamente o mesmo "sucesso mentiroso" das 4 rotinas que corrigi ontem à noite. **Este ficou
de fora** — não estava na lista.

**2. Código morto:** `getVslsForComparison` não tem nenhum chamador e consulta 3 tabelas vazias.

---

## Ressalva sobre a contagem

Não consegui reconsultar o banco (sem credencial local nesta máquina). As 16 vêm do seu número
(16 de 22) cruzado com o código — as 6 com dado são `offer_tracking`, `metrics_snapshots`,
`change_log`, `external_mappings`, `agent_approvals`, `agent_products`.

**Ponto de conferência:** se `alerts` ou `alert_history` tiverem linhas de verdade, então
`external_mappings` ou `operation_commands` está no lugar delas. Um `select count(*)` nessas
quatro fecha a dúvida quando você tiver o banco na mão.

---

## Sugestão de ordem

1. **Cadastrar a equipe** (`team_members`) — resolve 4 telas de uma vez, e não exige código
2. **Decidir `projects`**: as telas param de lê-la, ou ela passa a ser preenchida
3. **Criar a primeira regra de alerta** — a rotina já roda, só não tem o que avaliar
4. **`campaign_creatives`** é a única segura de apagar sem pensar (mas você disse para não
   apagar, então fica anotada)

**Nada disso foi feito.** É levantamento.
