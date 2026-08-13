/**
 * Setup de autenticação Clerk para testes E2E.
 * Usa a Clerk Backend API para criar uma sessão sem precisar de senha.
 *
 * Rodar: npx ts-node tests/setup-auth.ts
 * Ou via Playwright: npx playwright test --project=setup
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "https://banco-de-dados-ngv.vercel.app";
const AUTH_FILE = path.join(process.cwd(), ".auth/user.json");
const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
const TEST_EMAIL = "ngvdigital.ia@gmail.com";

async function main() {
  console.log("=== Setup Auth Clerk (Backend API) ===");

  if (!CLERK_SECRET) {
    throw new Error(
      "CLERK_SECRET_KEY ausente no ambiente; nenhum fallback local é permitido",
    );
  }

  // 1. Busca o userId pelo email via Clerk API
  const usersRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(TEST_EMAIL)}`,
    { headers: { Authorization: `Bearer ${CLERK_SECRET}` } },
  );

  if (!usersRes.ok) {
    throw new Error(`Clerk API erro: ${usersRes.status} ${await usersRes.text()}`);
  }

  const users = (await usersRes.json()) as Array<{
    id: string;
    email_addresses: Array<{ email_address: string }>;
  }>;
  if (!users.length) throw new Error(`Usuário ${TEST_EMAIL} não encontrado no Clerk`);

  const userId = users[0].id;
  console.log("Usuário de teste encontrado");

  // 2. Cria um sign-in token (válido por 24 horas)
  const tokenRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 86400 }),
  });

  if (!tokenRes.ok) {
    throw new Error(
      `Clerk sign_in_tokens erro: ${tokenRes.status} ${await tokenRes.text()}`,
    );
  }

  const tokenData = (await tokenRes.json()) as { token: string; url: string };
  console.log("Token de login temporário gerado");

  // 3. Usa o token para autenticar no browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Clerk fornece uma URL especial para ticket-based sign-in
  const signInUrl = `${BASE}/sign-in?__clerk_ticket=${tokenData.token}`;
  console.log("Navegando com token temporário");

  await page.goto(signInUrl);
  await page.waitForURL((url) => !url.href.includes("sign-in"), { timeout: 20000 });

  console.log(`Autenticado! URL atual: ${page.url()}`);

  // 4. Salva o storageState
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  console.log(`StorageState salvo em: ${AUTH_FILE}`);

  await browser.close();
}

main().catch((err) => {
  console.error("ERRO:", err.message);
  process.exit(1);
});
