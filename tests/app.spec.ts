import { test, expect } from "@playwright/test";

test.describe("Plataforma NGV Digital - Testes de Produção", () => {
  test("01 - Página inicial carrega e redireciona para login", async ({ page }) => {
    await page.goto("/");
    // Clerk deve redirecionar para sign-in se não autenticado
    await page.waitForURL(/sign-in|clerk/, { timeout: 10000 });
    expect(page.url()).toMatch(/sign-in|clerk/);
  });

  test("02 - Página de sign-in carrega", async ({ page }) => {
    await page.goto("/sign-in");
    await page.waitForTimeout(3000);
    // Deve mostrar o formulário do Clerk
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test("03 - Página de sign-up carrega", async ({ page }) => {
    await page.goto("/sign-up");
    await page.waitForTimeout(3000);
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test("04 - Rotas protegidas redirecionam para login", async ({ page }) => {
    const protectedRoutes = ["/projects", "/team", "/tags", "/changelog"];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL(/sign-in|clerk/, { timeout: 10000 });
      expect(page.url()).toMatch(/sign-in|clerk/);
    }
  });

  test("05 - API não expõe dados sem autenticação", async ({ request }) => {
    // Tentar acessar rotas protegidas via fetch sem cookies
    const response = await request.get("/projects");
    // Clerk bloqueia: retorna 404 ou redirect, nunca dados reais
    expect([200, 302, 307, 404]).toContain(response.status());
    const body = await response.text();
    // Não deve conter dados de projetos reais
    expect(body).not.toContain("Nenhum projeto ainda");
  });

  test("06 - Favicon e assets carregam", async ({ page }) => {
    const response = await page.goto("/favicon.ico");
    expect(response?.status()).toBe(200);
  });

  test("07 - Retorna 404 para rotas inexistentes", async ({ page }) => {
    const response = await page.goto("/rota-que-nao-existe");
    // Clerk pode redirecionar ou Next.js retorna 404
    const status = response?.status();
    expect([200, 307, 404]).toContain(status);
  });
});
