# Auditoria de Segurança — NGV Digital

Data: 2026-04-08

## Resumo
- Auth: Clerk (middleware protege todas as rotas)
- API routes: Crons protegidos por CRON_SECRET
- Webhooks: /api/webhooks/sales aberto (público), /api/webhooks/google-sheets protegido por secret

---

## Issues por Severidade

### CRÍTICO

#### 1. SQL Injection via sql.raw()
**Arquivo:** `src/app/(dashboard)/analytics/actions.ts`
**Linhas:** 92-96, 113-115
```ts
const vals = filters.statuses.map((s) => `'${s}'`).join(",");
conditions.push(sql`${projects.status} IN (${sql.raw(vals)})`);
```
Valores vindos de searchParams do usuário passados direto para `sql.raw()`. Um atacante poderia injetar SQL via URL params.
**Fix:** Usar `inArray()` do Drizzle.

### ALTO

#### 2. Webhook /api/webhooks/sales sem autenticação
**Arquivo:** `src/app/api/webhooks/sales/route.ts`
O endpoint aceita qualquer POST sem verificação de origem. Um atacante pode enviar dados falsos de vendas.
**Fix:** Adicionar verificação de signature/secret ou whitelist de IPs.

#### 3. API keys no .env.local no git
**Arquivo:** `.env.local`
O arquivo está no `.gitignore` mas `.env.example` contém nomes das variáveis (correto). Verificar que `.env.local` nunca foi commitado.

### MÉDIO

#### 4. Middleware Clerk — rotas de API excluídas
**Arquivo:** `src/middleware.ts`
```ts
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/cron(.*)",
  "/api/webhooks(.*)",
]);
```
Todas as rotas `/api/cron/*` e `/api/webhooks/*` são públicas. Os crons verificam `CRON_SECRET` no handler, mas se um dev esquecer, a rota fica exposta.

#### 5. CRON_SECRET como única proteção dos crons
Se o CRON_SECRET vazar, qualquer pessoa pode triggerar syncs. Vercel Crons automaticamente passam o secret, mas chamadas manuais precisam dele.

#### 6. Clerk em modo Development
As keys são `pk_test_` e `sk_test_` — modo desenvolvimento. Em produção, deveria usar keys de produção.

### BAIXO

#### 7. Sem rate limiting nos webhooks
Os endpoints de webhook não têm rate limiting. Um atacante poderia fazer flooding.

#### 8. Sem CORS headers explícitos
As API routes não definem CORS. Next.js permite same-origin por padrão, mas webhooks de plataformas externas podem ter issues.

#### 9. updateOfferField aceita qualquer campo
**Arquivo:** `src/app/(dashboard)/offers/actions.ts`
A allowlist de campos é ampla. Um atacante autenticado poderia modificar campos sensíveis.

---

## Boas Práticas Seguidas ✅

- [x] Variáveis de ambiente para secrets (não hardcoded)
- [x] Clerk middleware protege rotas do dashboard
- [x] .env.local no .gitignore
- [x] Server Actions com "use server"
- [x] Zod validation nos schemas de input
- [x] Passwords nunca armazenadas (Clerk gerencia)
- [x] HTTPS em produção (Vercel)
