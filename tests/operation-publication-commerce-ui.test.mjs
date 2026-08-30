import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("publicação autentica antes das três leituras e inicia comércio em paralelo", async () => {
  const page = await source("src/app/(dashboard)/sistemas/publicacao/page.tsx");
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

test("visão apresenta estados e métricas comerciais sem expor identidade de produto ou PII", async () => {
  const view = await source("src/components/operacao/operation-publication-view.tsx");
  for (const copy of [
    "Venda e acesso confirmados",
    "Venda sem acesso confirmado",
    "Evento em quarentena",
    "Produto sem mapeamento",
    "Entrega externa",
    "Venda observada",
    "Venda ainda não observada",
    "Fonte desatualizada",
    "Aguardando dados",
    "Leitura comercial ainda desligada",
    "Core comercial indisponível, dados não confirmados",
    "Produtos mapeados",
    "Acessos ativos",
    "Readbacks",
    "Quarentenas",
  ]) {
    assert.match(view, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(view, /pendingCommerceRecord\(record\)/);
  assert.match(view, /md:hidden/);
  assert.match(view, /hidden overflow-x-auto md:block/);
  assert.doesNotMatch(view, /["']use client["']/);
  assert.doesNotMatch(view, /\bfetch\s*\(/);
  assert.doesNotMatch(view, /process\.env/);
  assert.doesNotMatch(view, /<iframe\b/i);
  assert.doesNotMatch(view, /product_id|external_product_id|purchase_events|offer_slug|email|public_key|readerKey/);
});
