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
