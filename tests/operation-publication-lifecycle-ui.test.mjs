import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("publicação autentica antes das três leituras e as inicia em paralelo", async () => {
  const page = await source("src/app/(dashboard)/sistemas/publicacao/page.tsx");
  assert.match(page, /readOperationLifecycleEvidenceProjection/);
  assert.match(page, /readOperationCommerceReadbackProjection/);
  assert.match(page, /const \[projection, lifecycle, commerce\] = await Promise\.all\(/);
  assert.ok(
    page.indexOf("await requireOperationOperator()") < page.indexOf("const [projection, lifecycle, commerce] = await Promise.all("),
  );
  assert.match(page, /readOperationPublicationProjection\(\)/);
  assert.match(page, /readOperationLifecycleEvidenceProjection\(\)/);
  assert.match(page, /readOperationCommerceReadbackProjection\(\)/);
  assert.doesNotMatch(page, /\bfetch\s*\(/);
});

test("visão mantém registro local separado do lifecycle e cobre todos os estados", async () => {
  const view = await source("src/components/operacao/operation-publication-view.tsx");
  for (const copy of [
    "Registrado localmente",
    "7/7 provas válidas",
    "Falha comprovada",
    "Prova vencida",
    "Identidade divergente",
    "Aguardando provas",
    "Integração ainda desligada",
    "Core indisponível, estados não confirmados",
    "PENDING significa que ainda faltam provas independentes",
    "Banco #{record.offerTrackingId}",
  ]) {
    assert.match(view, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(view, /pendingLifecycleRecord\(record\)/);
  assert.match(view, /REGISTERED só confirma/);
  assert.doesNotMatch(view, /externalVerificationState/);
});

test("visão detalha as sete provas sem expor navegador, URL ou variáveis", async () => {
  const view = await source("src/components/operacao/operation-publication-view.tsx");
  for (const label of [
    "Escopo",
    "Local",
    "Visual",
    "URL pública",
    "Checkout",
    "Tracking",
    "Produção",
  ]) {
    assert.match(view, new RegExp(label));
  }
  assert.match(view, /<details/);
  assert.match(view, /<time dateTime=/);
  assert.match(view, /md:hidden/);
  assert.match(view, /hidden overflow-x-auto md:block/);
  assert.match(view, /<th scope="col"/);
  assert.doesNotMatch(view, /["']use client["']/);
  assert.doesNotMatch(view, /\bfetch\s*\(/);
  assert.doesNotMatch(view, /process\.env/);
  assert.doesNotMatch(view, /<iframe\b/i);
});
