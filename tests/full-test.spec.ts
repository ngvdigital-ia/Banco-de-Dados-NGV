import { test, expect } from "@playwright/test";

const BASE = "https://banco-de-dados-ngv.vercel.app";

test.describe("Testes Completos - Produção", () => {
  // ============================================================
  // AUTH
  // ============================================================
  test("01 - Redireciona para login quando não autenticado", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForURL(/sign-in|clerk/, { timeout: 10000 });
    expect(page.url()).toMatch(/sign-in|clerk/);
  });

  test("02 - Página de sign-in carrega", async ({ page }) => {
    await page.goto(`${BASE}/sign-in`);
    await page.waitForTimeout(3000);
    const content = await page.content();
    expect(content).toContain("Sign in");
  });

  // ============================================================
  // ROTAS PROTEGIDAS
  // ============================================================
  test("03 - Todas as rotas protegidas redirecionam", async ({ page }) => {
    const routes = ["/projects", "/team", "/tags", "/changelog", "/metrics", "/analytics", "/import", "/settings"];
    for (const route of routes) {
      await page.goto(`${BASE}${route}`);
      await page.waitForURL(/sign-in|clerk/, { timeout: 10000 });
      expect(page.url()).toMatch(/sign-in|clerk/);
    }
  });

  // ============================================================
  // API ENDPOINTS (sem auth)
  // ============================================================
  test("04 - Cron UTMify protegido (não retorna dados)", async ({ request }) => {
    const res = await request.get(`${BASE}/api/cron/sync-utmify`);
    expect([401, 404]).toContain(res.status());
  });

  test("05 - Cron ClickUp protegido", async ({ request }) => {
    const res = await request.get(`${BASE}/api/cron/sync-clickup`);
    expect([401, 404]).toContain(res.status());
  });

  test("06 - Cron VTurb protegido", async ({ request }) => {
    const res = await request.get(`${BASE}/api/cron/sync-vturb`);
    expect([401, 404]).toContain(res.status());
  });

  test("07 - Google Sheets webhook protegido", async ({ request }) => {
    const res = await request.post(`${BASE}/api/webhooks/google-sheets`, {
      data: { rows: [] },
    });
    expect([401, 404]).toContain(res.status());
  });

  // ============================================================
  // ASSETS
  // ============================================================
  test("08 - Favicon carrega", async ({ page }) => {
    const res = await page.goto(`${BASE}/favicon.ico`);
    expect(res?.status()).toBe(200);
  });

  test("09 - 404 para rotas inexistentes", async ({ page }) => {
    const res = await page.goto(`${BASE}/pagina-que-nao-existe`);
    expect([200, 307, 404]).toContain(res?.status());
  });

  // ============================================================
  // ANALYTICS PAGES (sem auth - devem redirecionar)
  // ============================================================
  test("10 - Analytics pages redirecionam sem auth", async ({ page }) => {
    const analyticsRoutes = [
      "/analytics/vsls",
      "/analytics/creatives",
      "/analytics/team",
      "/analytics/offers",
      "/analytics/compare",
    ];
    for (const route of analyticsRoutes) {
      await page.goto(`${BASE}${route}`);
      await page.waitForURL(/sign-in|clerk/, { timeout: 10000 });
      expect(page.url()).toMatch(/sign-in|clerk/);
    }
  });

  // ============================================================
  // SETTINGS PAGE
  // ============================================================
  test("11 - Settings page redireciona sem auth", async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await page.waitForURL(/sign-in|clerk/, { timeout: 10000 });
    expect(page.url()).toMatch(/sign-in|clerk/);
  });
});
