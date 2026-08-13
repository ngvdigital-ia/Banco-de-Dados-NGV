import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "https://banco-de-dados-ngv.vercel.app";
const AUTH_FILE = path.join(process.cwd(), ".auth/user.json");

// Colunas esperadas na tabela (com dados UTMify)
const COLUNAS_BASE = ["Oferta", "Idioma", "Copy VSL", "Ads Editados", "Validacao", "Escala"];
const COLUNAS_UTMIFY = ["Campanhas", "Gasto", "Receita", "ROAS", "Ads UTM"];

async function loginIfNeeded(page: Page) {
  await page.goto(`${BASE}/analytics/creatives`);
  // Se redirecionou para Clerk, faz login
  if (page.url().includes("clerk") || page.url().includes("sign-in")) {
    const senha = process.env.TEST_PASSWORD ?? "";
    if (!senha) throw new Error("TEST_PASSWORD não definido. Rode: TEST_PASSWORD=suasenha npx playwright test tests/creatives.spec.ts");

    // Aguarda o campo de email aparecer
    await page.waitForSelector('input[name="identifier"], input[type="email"]', { timeout: 15000 });
    await page.fill('input[name="identifier"], input[type="email"]', "ngvdigital.ia@gmail.com");

    // Clica no botão "Continue" visível do Clerk (não o aria-hidden)
    await page.click('button:visible:has-text("Continue")', { timeout: 10000 });

    // Aguarda campo de senha
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', senha);

    // Clica em "Continue" na tela de senha
    await page.click('button:visible:has-text("Continue")', { timeout: 10000 });

    // Aguarda retornar ao app
    await page.waitForURL(`${BASE}/**`, { timeout: 25000 });

    // Salva storageState para reuso
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    await page.context().storageState({ path: AUTH_FILE });
  }
}

test.describe("Página de Criativos — produção", () => {
  test.beforeEach(async ({ page }) => {
    // storageState já injetado pelo playwright.config.ts (projeto chromium)
    // Se por algum motivo não existir, faz login programático
    if (!fs.existsSync(AUTH_FILE)) {
      await loginIfNeeded(page);
    } else {
      await page.goto(`${BASE}/analytics/creatives`);
    }
    // Aguarda a tabela principal carregar
    await page.waitForSelector("table", { timeout: 30000 });
  });

  // ----------------------------------------------------------------
  // 1. Verificação de colunas
  // ----------------------------------------------------------------
  test("01 - Tabela exibe todas as colunas esperadas", async ({ page }) => {
    const headers = await page.$$eval("thead th", (ths) =>
      ths.map((th) => th.textContent?.trim() ?? "")
    );
    console.log("Colunas encontradas:", headers);

    for (const coluna of COLUNAS_BASE) {
      expect(headers, `Coluna "${coluna}" deve existir`).toContain(coluna);
    }

    // Verifica se colunas UTMify aparecem (dados de campanha existem)
    const temUTM = headers.includes("Ads UTM");
    console.log("Colunas UTMify presentes:", temUTM);
    if (temUTM) {
      for (const coluna of COLUNAS_UTMIFY) {
        expect(headers, `Coluna UTM "${coluna}" deve existir`).toContain(coluna);
      }
    }

    await page.screenshot({
      path: "test-results/criativos-01-colunas.png",
      fullPage: true,
    });
  });

  // ----------------------------------------------------------------
  // 2. Coluna "Ads UTM" exibe números
  // ----------------------------------------------------------------
  test("02 - Coluna Ads UTM exibe valores numéricos", async ({ page }) => {
    // Identifica índice da coluna "Ads UTM"
    const headerTexts = await page.$$eval("thead th", (ths) =>
      ths.map((th) => th.textContent?.trim() ?? "")
    );
    const adsUtmIndex = headerTexts.indexOf("Ads UTM");

    if (adsUtmIndex === -1) {
      test.skip(); // Sem dados UTMify — skipa
      return;
    }

    // Pega células da coluna Ads UTM nas linhas de dados (não linhas expandidas)
    const cells = await page.$$eval(
      `tbody tr:not(.bg-muted\\/30) td:nth-child(${adsUtmIndex + 1})`,
      (tds) => tds.map((td) => td.textContent?.trim() ?? "")
    );

    console.log("Valores Ads UTM:", cells);

    // Pelo menos uma linha deve ter número > 0
    const numericos = cells.filter((v) => /^\d+$/.test(v) && parseInt(v) > 0);
    console.log(`Linhas com Ads UTM > 0: ${numericos.length}`);
    expect(numericos.length, "Deve haver pelo menos 1 oferta com Ads UTM numérico").toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // 3. Linha Skyvault expande ao clicar
  // ----------------------------------------------------------------
  test("03 - Skyvault expande e mostra sub-linhas de ads", async ({ page }) => {
    // Procura linha cujo texto de oferta contenha "Skyvault" (case-insensitive)
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    let skyRow: ReturnType<Page["locator"]> | null = null;

    for (let i = 0; i < count; i++) {
      const txt = await rows.nth(i).locator("td:nth-child(2)").textContent();
      if (txt?.toLowerCase().includes("skyvault")) {
        skyRow = rows.nth(i);
        break;
      }
    }

    if (!skyRow) {
      console.log("Oferta Skyvault não encontrada na tabela — verificar se existe no DB");
      test.skip();
      return;
    }

    const rowsBefore = await page.$$eval("tbody tr", (trs) => trs.length);

    // Clica na linha Skyvault
    await skyRow.click();

    // Aguarda sub-linhas aparecerem (bg-muted/30)
    await page.waitForSelector("tbody tr.bg-muted\\/30, tbody tr[class*='muted']", { timeout: 5000 })
      .catch(() => console.log("Nenhuma sub-linha com classe bg-muted apareceu"));

    const rowsAfter = await page.$$eval("tbody tr", (trs) => trs.length);
    console.log(`Linhas antes: ${rowsBefore}, depois: ${rowsAfter} — diff: ${rowsAfter - rowsBefore} ads`);

    // Deve ter adicionado pelo menos 1 linha
    expect(rowsAfter).toBeGreaterThan(rowsBefore);

    // Captura dados dos ads expandidos
    const adRows = await page.$$eval("tbody tr", (trs) =>
      trs
        .filter((tr) => tr.className.includes("muted"))
        .map((tr) => {
          const cells = Array.from(tr.querySelectorAll("td"));
          return cells.map((td) => td.textContent?.trim() ?? "");
        })
    );

    console.log("Sub-linhas Skyvault:");
    adRows.forEach((ad, idx) => {
      console.log(`  AD[${idx}]:`, ad.filter((v) => v).join(" | "));
    });

    await page.screenshot({
      path: "test-results/criativos-03-skyvault-expandido.png",
      fullPage: true,
    });
  });

  // ----------------------------------------------------------------
  // 4. Linha FVA expande ao clicar
  // ----------------------------------------------------------------
  test("04 - FVA expande e mostra sub-linhas de ads", async ({ page }) => {
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    let fvaRow: ReturnType<Page["locator"]> | null = null;

    for (let i = 0; i < count; i++) {
      const txt = await rows.nth(i).locator("td:nth-child(2)").textContent();
      if (txt?.toLowerCase().includes("fva")) {
        fvaRow = rows.nth(i);
        break;
      }
    }

    if (!fvaRow) {
      console.log("Oferta FVA não encontrada na tabela");
      test.skip();
      return;
    }

    const rowsBefore = await page.$$eval("tbody tr", (trs) => trs.length);
    await fvaRow.click();

    // Aguarda mudança no DOM
    await page.waitForFunction(
      (before) => document.querySelectorAll("tbody tr").length > before,
      rowsBefore,
      { timeout: 5000 }
    ).catch(() => console.log("DOM não mudou após clicar em FVA"));

    const rowsAfter = await page.$$eval("tbody tr", (trs) => trs.length);
    console.log(`FVA — linhas antes: ${rowsBefore}, depois: ${rowsAfter}`);

    await page.screenshot({
      path: "test-results/criativos-04-fva-expandido.png",
      fullPage: true,
    });

    expect(rowsAfter).toBeGreaterThan(rowsBefore);
  });

  // ----------------------------------------------------------------
  // 5. Sub-linha de ad contém: número do ad, editores, dropdown formato
  // ----------------------------------------------------------------
  test("05 - Sub-linhas de ads contêm dados esperados (AD number, editores, dropdown)", async ({ page }) => {
    // Clica na primeira linha que tenha o ícone de expansão (ChevronRight)
    const expandableRow = page
      .locator("tbody tr.cursor-pointer, tbody tr[class*='cursor']")
      .first();

    const exists = await expandableRow.count();
    if (exists === 0) {
      console.log("Nenhuma linha expansível encontrada");
      test.skip();
      return;
    }

    await expandableRow.click();

    // Aguarda sub-linhas
    await page.waitForTimeout(800);

    // Verifica badge com número do AD (formato mono)
    const adBadges = page.locator("tbody tr .font-mono");
    const badgeCount = await adBadges.count();
    console.log(`Badges de AD encontrados: ${badgeCount}`);
    expect(badgeCount).toBeGreaterThan(0);

    // Verifica dropdown de formato
    const selects = page.locator("tbody tr button[role='combobox']");
    const selectCount = await selects.count();
    console.log(`Dropdowns de formato encontrados: ${selectCount}`);
    expect(selectCount).toBeGreaterThan(0);

    // Loga conteúdo dos badges
    for (let i = 0; i < Math.min(badgeCount, 5); i++) {
      const txt = await adBadges.nth(i).textContent();
      console.log(`  Badge AD[${i}]: "${txt}"`);
    }

    await page.screenshot({
      path: "test-results/criativos-05-ads-detalhes.png",
      fullPage: true,
    });
  });

  // ----------------------------------------------------------------
  // 6. Screenshot geral da página
  // ----------------------------------------------------------------
  test("06 - Screenshot geral da página de Criativos", async ({ page }) => {
    // Expande Skyvault e FVA se existirem para mostrar tudo
    const rows = page.locator("tbody tr");
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const txt = await rows.nth(i).locator("td:nth-child(2)").textContent();
      if (txt?.toLowerCase().includes("skyvault") || txt?.toLowerCase().includes("fva")) {
        await rows.nth(i).click();
        await page.waitForTimeout(300);
      }
    }

    // Aguarda estabilizar
    await page.waitForTimeout(500);

    await page.screenshot({
      path: "test-results/criativos-06-pagina-completa.png",
      fullPage: true,
    });

    // Reporta resumo final
    const totalRows = await page.$$eval("tbody tr", (trs) => trs.length);
    const expandedRows = await page.$$eval("tbody tr", (trs) =>
      trs.filter((tr) => tr.className.includes("muted")).length
    );
    console.log(`\n=== RESUMO PÁGINA CRIATIVOS ===`);
    console.log(`Total de linhas na tabela: ${totalRows}`);
    console.log(`Sub-linhas de ads visíveis: ${expandedRows}`);
    console.log(`Linhas de oferta: ${totalRows - expandedRows}`);

    expect(totalRows).toBeGreaterThan(0);
  });
});
