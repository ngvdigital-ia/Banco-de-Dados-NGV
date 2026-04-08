# NGV Digital — Plataforma de Dados

Painel administrativo interno da NGV Digital para centralizar dados de operação: projetos, VSLs, funis, criativos, equipe, métricas e acompanhamento de ofertas.

## Links
- **Produção:** https://banco-de-dados-ngv.vercel.app
- **Repo:** https://github.com/ngvdigital-ia/Banco-de-Dados-NGV
- **Vercel Dashboard:** https://vercel.com/ngvdigitas-projects/banco-de-dados-ngv

## Documentação

| Documento | Descrição |
|-----------|-----------|
| [PROJECT-MAP.md](PROJECT-MAP.md) | Mapa completo do projeto (rotas, tabelas, componentes, integrações) |
| [Banco de dados.md](Banco%20de%20dados.md) | Documento original de requisitos |
| [audit/DATABASE-AUDIT.md](audit/DATABASE-AUDIT.md) | Auditoria do banco de dados |
| [audit/SECURITY-AUDIT.md](audit/SECURITY-AUDIT.md) | Auditoria de segurança |
| [audit/API-INTEGRATIONS-AUDIT.md](audit/API-INTEGRATIONS-AUDIT.md) | Auditoria de APIs e integrações |
| [audit/PRIORITY-FIXES.md](audit/PRIORITY-FIXES.md) | Lista priorizada de correções |

## Equipe no Sistema

| Sigla | Nome | Função | Email |
|-------|------|--------|-------|
| DG | Diogo | Copywriter | ngvdigital10@gmail.com |
| GA | Gabriel | Copywriter | gabrielfischer.ngvdigital@gmail.com |
| RO | Robert | Copywriter | robertoliveira.ngvdigital@gmail.com |
| MALU | Malu (Maria Luisa) | Editor | maria.luisa.ngvdigital@gmail.com |
| VA | Victor Andrade | Editor | victorandrade.ngvdigital@gmail.com |
| CA | Camile | Editor | camilengvdigital@gmail.com |
| LF | Luis Felipe | Editor | luisaraujo.ngvdigital@gmail.com |

## Integrações

| Serviço | Status | Dados |
|---------|--------|-------|
| VTurb | ✅ | Players, plays, views, finishes, retention |
| ClickUp | ✅ | Tarefas por editor/mês |
| UTMify | ⚠️ MCP | Dados via Claude MCP (sem API REST) |
| Webhook Vendas | ✅ | Plataformas de pagamento → dashboard |
| Slack | ✅ | Lembretes diários |

## Como rodar localmente
```bash
npm install
cp .env.example .env.local  # preencher variáveis
npx drizzle-kit push         # criar tabelas
npm run dev
```
