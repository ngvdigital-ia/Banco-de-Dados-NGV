# Mapa do Projeto — NGV Digital Dashboard

## Stack
- **Framework:** Next.js 16.2.2 (App Router, TypeScript)
- **UI:** shadcn/ui (base-ui) + Tailwind CSS v4
- **ORM:** Drizzle ORM + Neon Postgres (serverless)
- **Auth:** Clerk
- **Charts:** Recharts
- **Deploy:** Vercel (Pro)
- **Integrações:** UTMify (MCP), VTurb (API REST), ClickUp (API REST)

## Páginas (25 rotas)

| Rota | Tipo | Função |
|------|------|--------|
| `/` | Server | Dashboard principal com cards, gráficos, VTurb summary |
| `/projects` | Server + searchParams | Lista projetos com filtros (nicho, idioma, status) |
| `/projects/[id]` | Server | Detalhe do projeto com tabs (VSLs, Funil, Criativos) |
| `/offers` | Server + searchParams | Acompanhamento de Ofertas (tabela editável inline) |
| `/team` | Server | CRUD de equipe |
| `/metrics` | Server | Formulário de métricas manuais |
| `/analytics` | Server | Hub de análises (5 cards) |
| `/analytics/vsls` | Server + searchParams | Performance de VSLs + métricas VTurb |
| `/analytics/creatives` | Server + searchParams | Performance de Criativos por formato |
| `/analytics/team` | Server + searchParams | Performance de Editores |
| `/analytics/offers` | Server + searchParams | Ranking de Ofertas |
| `/analytics/compare` | Client | Comparação lado a lado (nicho/língua/copy/editor) |
| `/ab-tests` | Server | Testes A/B (mantido, pouco usado) |
| `/alerts` | Server | Alertas configuráveis |
| `/import` | Client | Import CSV (ofertas + métricas) |
| `/settings` | Server | Integrações (UTMify, ClickUp, VTurb) |
| `/tags` | Server | Gerenciamento de tags |
| `/changelog` | Server | Histórico de alterações |
| `/sign-in` | Server | Login Clerk |
| `/sign-up` | Server | Cadastro Clerk |
| `/api/cron/sync-utmify` | API GET | Cron UTMify (6h) |
| `/api/cron/sync-clickup` | API GET | Cron ClickUp (6h) |
| `/api/cron/sync-vturb` | API GET | Cron VTurb (12h) |
| `/api/cron/slack-reminder` | API GET | Lembrete Slack (seg-sex 9h/18h) |
| `/api/webhooks/sales` | API POST | Webhook vendas (plataformas de pagamento) |

## Banco de Dados (18 tabelas)

| Tabela | Campos | Função |
|--------|--------|--------|
| team_members | 8 | Equipe (nome, email, role, ativo) |
| projects | 10 | Projetos (nome, tipo VSL/TSL, nicho, idioma, status) |
| vsls | 12 | VSLs por projeto (versão, copywriter, duração, pit) |
| funnels | 8 | Funis por projeto (URLs, status) |
| funnel_nodes | 15 | Árvore upsell/downsell (self-referencing) |
| order_bumps | 6 | Order bumps do funil |
| creatives | 12 | Criativos (formato, plataforma, status validação) |
| campaigns | 10 | Campanhas de tráfego |
| campaign_creatives | 3 | Junction N:N campanhas ↔ criativos |
| tags | 4 | Tags (nome, tipo) |
| entity_tags | 4 | Junction polimórfica tags ↔ entidades |
| change_log | 7 | Histórico de mudanças |
| metrics_snapshots | 26 | Métricas (tráfego, vendas, checkout, consolidados) |
| external_mappings | 6 | Mapeamento entidades internas ↔ externas |
| ab_tests | 10 | Testes A/B |
| ab_test_variants | 6 | Variantes dos testes A/B |
| alerts | 10 | Alertas configuráveis |
| alert_history | 5 | Histórico de alertas disparados |
| offer_tracking | 26 | Acompanhamento de Ofertas (substitui planilha) |

## Componentes Principais

| Componente | Tipo | Função |
|-----------|------|--------|
| app-sidebar.tsx | Client | Sidebar com navegação (11 items) |
| offer-table.tsx | Client | Tabela editável inline de ofertas |
| csv-import-dialog.tsx | Client | Dialog para import CSV |
| analytics-filters.tsx | Client | Filtros multi-select para analytics |
| comparison-view.tsx | Client | Comparação lado a lado |
| spend-revenue-chart.tsx | Client | Gráfico gasto vs receita (Recharts) |
| roas-chart.tsx | Client | Gráfico ROAS (Recharts) |
| team-form.tsx | Client | Formulário de membro da equipe |
| project-form.tsx | Client | Formulário de projeto |
| entity-tags.tsx | Client | Tags vinculáveis a entidades |
| date-range-filter.tsx | Client | Filtro de período |
| entity-filters.tsx | Client | Filtros por nicho/idioma/status |

## Integrações

| Serviço | Status | Dados |
|---------|--------|-------|
| **VTurb** | ✅ Funcionando | 342 players, plays, views, finishes, clicks |
| **ClickUp** | ✅ Funcionando | Tarefas por editor/mês de todas as pastas |
| **UTMify** | ⚠️ Via MCP | Dados puxados manualmente via Claude MCP |
| **Webhook Vendas** | ✅ Pronto | Endpoint para plataformas de pagamento |
| **Slack** | ✅ Configurado | Lembrete diário seg-sex |

## Variáveis de Ambiente

| Variável | Onde |
|----------|------|
| DATABASE_URL | Vercel + .env.local |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Vercel + .env.local |
| CLERK_SECRET_KEY | Vercel + .env.local |
| UTMIFY_API_KEY | Vercel + .env.local |
| VTURB_API_KEY | Vercel + .env.local |
| CLICKUP_API_KEY | Vercel + .env.local |
| CRON_SECRET | Vercel + .env.local |
| SLACK_WEBHOOK_URL | Vercel + .env.local |
