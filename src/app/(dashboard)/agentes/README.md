# Aba Agentes

Interface de operação dos **Agentes IA da NGV Digital** (Black / White / Triagem).
Portada do app standalone `agentes-ngv-ui` para dentro do `Banco_de_dados_NGV`
(consolidação das duas plataformas numa só).

- **Origem:** repo `ngvdigital-ia/agentes-ngv-ui`.
- **App antigo:** ainda no ar em `https://agentes-ngv-ui.vercel.app` — será
  desligado depois que esta migração for validada.
- **Adaptações da migração:** Supabase Auth → Clerk; Supabase DB → Neon/Drizzle.
  Não há nenhuma dependência de Supabase nesta aba.

## Estrutura

- `page.tsx` — Kanban de ofertas (colunas Black e White, 4 estados:
  `pra_amanha`, `pra_hoje`, `em_execucao`, `executada`).
- `components/` — cards, colunas, seções de estado, `ApprovalSheet`
  (aprovar/rejeitar com feedback por texto ou áudio).
- `triagem/` — tela de candidatos triados, com filtros (vaga/classificação),
  busca e painel lateral de detalhes.
- Rotas de API: `src/app/api/agentes/*` — `ofertas`, `candidatos`, `approvals`,
  `transcribe`, `black/re-execute`.
- Wrappers de integração: `src/lib/agentes/*` — n8n, anthropic, clickup,
  ofertas, triagem.

## Variáveis de ambiente

Necessárias em `.env.local` (ver `.env.example`):

| Var | Uso |
|---|---|
| `N8N_BASE_URL`, `N8N_API_KEY` | API do n8n (executions) |
| `ANTHROPIC_API_KEY` | Managed Agents do Anthropic (sessions) |
| `CLICKUP_API_TOKEN` | Tasks/ofertas do ClickUp |
| `TRIAGEM_WEBHOOK_LISTAR_URL` | Webhook que lista os candidatos triados |
| `GROQ_API_KEY` | Transcrição de áudio (Whisper) |
| `BLACK_MANUAL_WEBHOOK_URL` | Disparo manual / re-execução do Black |

## Banco de dados

Tabela `agent_approvals` (decisões de aprovação dos agentes) — definida em
`src/db/schema.ts`; migration em `drizzle/0004_add_agent_approvals.sql`.

## Polimento UX (pós-merge)

Sprint de ajustes baseada no feedback do time após o primeiro uso da aba:

- **Header das colunas:** os 3 contadores agora têm ícones + tooltip
  (executadas / em execução / pendentes) em vez do críptico `5 / 0 / 2`.
- **Colapsar colunas:** cada coluna de agente tem um botão de expandir/colapsar;
  o estado é persistido em `localStorage` (`agentes-column-collapsed-<agente>`).
- **Loading skeleton:** `loading.tsx` mostra um skeleton imediato enquanto o
  `page.tsx` agrega as ofertas (ver "Performance" abaixo).
- **Alinhamento visual:** Kanban e Triagem seguem o padrão do dashboard
  `/offers` (sem fundo cinza próprio, sem padding duplo, badge de contagem,
  botões e tipografia harmonizados).

### Performance

O `page.tsx` é `export const dynamic = "force-dynamic"` e chama
`aggregateOfertas()` direto — isso re-agrega 5+ APIs externas (ClickUp, n8n ×2,
Anthropic ×2) **a cada visita**, que é a causa raiz da lentidão percebida. Esta
sprint adicionou o `loading.tsx` para feedback imediato, mas isso **não** é uma
aceleração real. O fix de verdade — cachear o resultado de `aggregateOfertas()` —
depende do modelo de cache do Next 16 e deve ser uma tarefa dedicada. (A rota
`/api/agentes/ofertas`, usada pelo botão "Atualizar", já tem `revalidate = 60`.)

### Doc principal / Produto gerado

O `OfertaCard` exibe "Doc principal" e "Produto gerado" sempre que o dado
existe — o código está correto. O `documento_principal_url` vem do custom field
**"Documento principal"** do ClickUp (match exato por nome). Numa verificação,
4 de 7 ofertas-pai tinham o campo preenchido e 3 não (`skyvault`, `Teste aula`,
`[TEMPLATE] Oferta`). É **dado faltando no ClickUp**, não bug do dashboard.
**TODO (time de ClickUp):** preencher o custom field "Documento principal" nas
ofertas que faltam (`[TEMPLATE] Oferta` é template — pode ficar vazio).

## Pendências conhecidas

1. **Re-execução com feedback não fecha o ciclo:** `/api/agentes/black/re-execute`
   dispara o webhook `manual-cria-black` com o `feedback` no payload, mas o
   workflow n8n `W7odSUjobmbeaQBC` ainda não injeta esse `feedback` no prompt do
   agente Black. Tarefa do time de n8n.
2. **Botão "Re-executar Black" é net-new:** o app de origem nunca teve esse botão
   (só a API route). Foi criado nesta migração, no `OfertaCard` dos cards Black
   executados.
3. **Áudio não é persistido:** o `.webm` é apenas transcrito (Groq), não salvo.
   Persistir exige storage (Fase B).
4. **Token do ClickUp é pessoal** (hoje, do Diogo) — trocar por um token de
   serviço dedicado.
5. **White roda muito pouco:** confirmar com a equipe se o agente White segue
   em uso.
6. **Triagem não está classificando:** os candidatos aparecem, mas a
   classificação não vem correta — é bug do workflow n8n `t26MZRLKNrC2prd1`
   (não do dashboard). Sprint separada com o time de n8n.
7. **Aprovar/Rejeitar não integra com o ClickUp:** hoje a decisão só grava em
   `agent_approvals`. O ideal seria mover status / postar comentário no card do
   ClickUp e refletir no dashboard de acompanhamento de ofertas. Feature de
   integração para uma sprint futura (precisa desenhar o fluxo antes).
