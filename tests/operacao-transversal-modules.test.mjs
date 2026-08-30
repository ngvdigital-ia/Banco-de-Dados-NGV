import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("módulos transversais não viram fontes do Core", async () => {
  const directory = await source("src/lib/operacao/system-directory.ts");
  assert.match(
    directory,
    /export const SYSTEM_IDS = \[\s*"banco-ngv",\s*"apps-ofertas",\s*"cursos",\s*"spy",\s*"quiz",\s*"nexfy",\s*"monitoramento",\s*\] as const;/s,
  );
  assert.match(
    directory,
    /export const TRANSVERSAL_OPERATION_MODULE_IDS = \[\s*"execucao",\s*"publicacao",\s*\] as const;/s,
  );
  assert.match(directory, /export type TransversalOperationModuleId/);
});

test("flags dos módulos são server-only e desligadas por padrão", async () => {
  const [feature, environment] = await Promise.all([
    source("src/lib/operacao/feature.ts"),
    source(".env.example"),
  ]);
  assert.match(
    feature,
    /isOperationExecutionModuleEnabled\s*=\s*\n?\s*typeof window === "undefined" && process\.env\.OPERATION_EXECUTION_MODULE_ENABLED === "true"/,
  );
  assert.match(
    feature,
    /isOperationDeploymentDomainsModuleEnabled\s*=\s*\n?\s*typeof window === "undefined" && process\.env\.OPERATION_DEPLOYMENT_DOMAINS_MODULE_ENABLED === "true"/,
  );
  assert.doesNotMatch(
    feature,
    /NEXT_PUBLIC_OPERATION_(?:EXECUTION|DEPLOYMENT_DOMAINS)_MODULE_ENABLED/,
  );
  assert.match(environment, /^OPERATION_EXECUTION_MODULE_ENABLED=false$/m);
  assert.match(
    environment,
    /^OPERATION_DEPLOYMENT_DOMAINS_MODULE_ENABLED=false$/m,
  );
});

test("rotas transversais fecham antes de autenticar ou consultar", async () => {
  const [execution, publication] = await Promise.all([
    source("src/app/(dashboard)/sistemas/execucao/page.tsx"),
    source("src/app/(dashboard)/sistemas/publicacao/page.tsx"),
  ]);
  for (const page of [execution, publication]) {
    assert.match(page, /import \{ notFound \} from "next\/navigation"/);
    assert.match(page, /export const dynamic = "force-dynamic"/);
    assert.ok(
      page.indexOf("if (!isOperation") <
        page.indexOf("await requireOperationOperator()"),
    );
    const firstRead = Math.max(
      page.indexOf("const projection = await readOperation"),
      page.indexOf("const [projection, lifecycle] = await Promise.all("),
      page.indexOf("const [projection, lifecycle, commerce] = await Promise.all("),
    );
    assert.ok(page.indexOf("await requireOperationOperator()") < firstRead);
    assert.doesNotMatch(page, /\bfetch\s*\(/);
  }
});

test("leitura de execução só seleciona recibos sanitizados", async () => {
  const execution = await source("src/lib/operacao/execution-module.ts");
  assert.match(execution, /import "server-only"/);
  assert.match(execution, /\.select\(\{\s*offerId:/s);
  assert.match(execution, /\.limit\(50\)/);
  assert.doesNotMatch(execution, /operationOfferBuildJobs\.jobIdHash/);
  assert.doesNotMatch(execution, /operationOfferBuildJobs\.payload/);
  assert.match(execution, /kind: "migration_unverified"/);
  assert.match(execution, /if \(!isOperationExecutionModuleEnabled\)/);
});

test("publicação projeta endereço local sem declarar deploy externo", async () => {
  const publication = await source("src/lib/operacao/publication-module.ts");
  assert.match(publication, /import "server-only"/);
  assert.match(publication, /projectOfferPublicationFromSiteUrls/);
  assert.match(publication, /offerTrackingId: offerTracking\.id/);
  assert.doesNotMatch(
    publication,
    /isNotNull\(offerTracking\.canonicalOfferId\)/,
  );
  assert.match(publication, /: "PENDING"/);
  assert.match(publication, /pendingIdentity/);
  assert.match(publication, /externalVerificationState: "PENDING"/);
  assert.match(
    publication,
    /localRegistrationState: publication\.local_registration_state/,
  );
  assert.doesNotMatch(
    publication,
    /externalVerificationState:\s*"(?:DEPLOYED|LIVE|VERIFIED)"/,
  );
  assert.match(
    publication,
    /if \(!isOperationDeploymentDomainsModuleEnabled\)/,
  );
});

test("sidebar recebe somente flags transversais autorizadas pelo servidor", async () => {
  const [layout, sidebar] = await Promise.all([
    source("src/app/(dashboard)/layout.tsx"),
    source("src/components/app-sidebar.tsx"),
  ]);
  assert.match(layout, /import \{ getCurrentUser \} from "@\/lib\/admin-auth"/);
  assert.match(layout, /import \{ isOperationOperator \} from "@\/lib\/operacao\/authz"/);
  assert.match(layout, /export default async function DashboardLayout/);
  assert.match(
    layout,
    /const hasEnabledTransversalModule\s*=\s*\n?\s*isOperationExecutionModuleEnabled \|\| isOperationDeploymentDomainsModuleEnabled;/,
  );
  assert.match(
    layout,
    /const currentUser = hasEnabledTransversalModule \? await getCurrentUser\(\) : null;/,
  );
  assert.match(
    layout,
    /const canDiscoverTransversalModules = isOperationOperator\(currentUser\?\.email\);/,
  );
  assert.match(
    layout,
    /isExecutionModuleEnabled=\{\s*isOperationExecutionModuleEnabled && canDiscoverTransversalModules\s*\}/,
  );
  assert.match(
    layout,
    /isPublicationModuleEnabled=\{\s*isOperationDeploymentDomainsModuleEnabled && canDiscoverTransversalModules\s*\}/,
  );
  assert.doesNotMatch(layout, /email=\{|email:/);
  assert.match(sidebar, /isExecutionModuleEnabled\?: boolean/);
  assert.match(sidebar, /isPublicationModuleEnabled\?: boolean/);
  assert.match(sidebar, /href: "\/sistemas\/execucao"/);
  assert.match(sidebar, /href: "\/sistemas\/publicacao"/);
  assert.doesNotMatch(sidebar, /OPERATION_EXECUTION_MODULE_ENABLED/);
  assert.doesNotMatch(sidebar, /OPERATION_DEPLOYMENT_DOMAINS_MODULE_ENABLED/);
  assert.doesNotMatch(sidebar, /isOperationOperator|OPERATION_OPERATOR_EMAILS/);
});

test("views de leitura são Server Components sem busca no navegador", async () => {
  const [execution, publication] = await Promise.all([
    source("src/components/operacao/operation-execution-view.tsx"),
    source("src/components/operacao/operation-publication-view.tsx"),
  ]);
  for (const view of [execution, publication]) {
    assert.doesNotMatch(view, /["']use client["']/);
    assert.doesNotMatch(view, /\bfetch\s*\(/);
    assert.doesNotMatch(view, /<iframe\b/i);
  }
  assert.match(execution, /Migração externa não verificada/);
  assert.match(execution, /Nenhum recibo local/);
  assert.match(publication, /Registrado localmente/);
  assert.match(publication, /Banco #\{record\.offerTrackingId\}/);
  assert.match(publication, /identidade pendente/);
  assert.match(publication, /Lifecycle PASS/);
  assert.match(publication, /REGISTERED só confirma/);
  assert.match(publication, /PENDING/);
});
