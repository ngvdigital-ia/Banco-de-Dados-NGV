import "server-only";
import { dispatchSpyMutationWithAudit as dispatchCore } from "./mutations-dispatch.mjs";
import {
  createSpyOferta,
  updateSpyOferta,
  deleteSpyOferta,
  saveSpyLeiturasBatch,
  updateSpyLeitura,
  deleteSpyLeitura,
  updateSpyConfig,
} from "./mutations-client.mjs";
import type {
  SpyConfigResult,
  SpyCreateOfertaInput,
  SpyLeitura,
  SpyLeiturasBatchResult,
  SpyLeituraItemInput,
  SpyMutationOptions,
  SpyMutationResult,
  SpyOferta,
  SpyOk,
  SpyPesos,
  SpyUpdateOfertaPatch,
} from "./mutations-client.d.mts";
import { requireModuleAccess } from "@/lib/sistemas/authz";
import { logModuleAction } from "@/lib/sistemas/audit";
import { requireSpyMutationsEnabled } from "./mutation-feature.mjs";

// Wrapper fino "server-only" em cima do núcleo testável (mutations-dispatch.mjs) — mesmo formato
// de cursos/push-dispatch.ts: só injeta as dependências reais (`requireModuleAccess`,
// `logModuleAction`). Nenhuma lógica nova aqui — o que este wrapper faz está coberto pelos testes
// do núcleo em tests/sistemas-spy-mutations-dispatch.test.mjs (com stubs de requireAccessImpl e
// logActionImpl) e do adapter em tests/sistemas-spy-mutations-client.test.mjs (com stubFetch,
// NUNCA batendo no Spy real).
//
// A UI (componentes de src/components/sistemas/spy/) fica pra outro handoff — este arquivo
// entrega só a camada de dados: 7 funções, uma por endpoint de escrita, todas passando por
// `requireModuleAccess("spy", "mutate")` e gravando em `module_action_log` antes de devolver.

async function requireAccessImpl(moduleId: "spy", capability: "mutate") {
  return requireModuleAccess(moduleId, capability);
}

// Separada da flag de leitura da rota. Este módulo inteiro é server-only, portanto a variável
// nunca é enviada ao navegador nem pode ser acionada pelo Client Component diretamente.
function requireMutationEnabledImpl() {
  requireSpyMutationsEnabled();
}

export async function createSpyOfertaWithAudit(
  input: SpyCreateOfertaInput,
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyOferta>> {
  return dispatchCore({
    action: "oferta_create",
    requireMutationEnabledImpl,
    requireAccessImpl,
    logActionImpl: logModuleAction,
    mutationImpl: () => createSpyOferta(input, options),
    targetRefOf: (_actor, result) => (result.kind === "success" ? result.data.id : input?.id ?? null),
    payload: input,
  });
}

export async function updateSpyOfertaWithAudit(
  id: string,
  patch: SpyUpdateOfertaPatch,
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyOferta>> {
  return dispatchCore({
    action: "oferta_update",
    requireMutationEnabledImpl,
    requireAccessImpl,
    logActionImpl: logModuleAction,
    mutationImpl: () => updateSpyOferta(id, patch, options),
    targetRefOf: () => id ?? null,
    payload: { id, patch },
  });
}

export async function deleteSpyOfertaWithAudit(
  id: string,
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyOk>> {
  return dispatchCore({
    action: "oferta_delete",
    requireMutationEnabledImpl,
    requireAccessImpl,
    logActionImpl: logModuleAction,
    mutationImpl: () => deleteSpyOferta(id, options),
    targetRefOf: () => id ?? null,
    payload: { id },
  });
}

export async function saveSpyLeiturasBatchWithAudit(
  itens: SpyLeituraItemInput[],
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyLeiturasBatchResult>> {
  return dispatchCore({
    action: "leituras_batch_save",
    requireMutationEnabledImpl,
    requireAccessImpl,
    logActionImpl: logModuleAction,
    mutationImpl: () => saveSpyLeiturasBatch(itens, options),
    targetRefOf: () =>
      Array.isArray(itens) && itens.length > 0
        ? itens.map((item) => item?.id).filter(Boolean).join(",")
        : null,
    payload: { itens },
  });
}

export async function updateSpyLeituraWithAudit(
  id: string,
  ads: number,
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyLeitura>> {
  return dispatchCore({
    action: "leitura_update",
    requireMutationEnabledImpl,
    requireAccessImpl,
    logActionImpl: logModuleAction,
    mutationImpl: () => updateSpyLeitura(id, ads, options),
    targetRefOf: () => id ?? null,
    payload: { id, ads },
  });
}

export async function deleteSpyLeituraWithAudit(
  id: string,
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyOk>> {
  return dispatchCore({
    action: "leitura_delete",
    requireMutationEnabledImpl,
    requireAccessImpl,
    logActionImpl: logModuleAction,
    mutationImpl: () => deleteSpyLeitura(id, options),
    targetRefOf: () => id ?? null,
    payload: { id },
  });
}

export async function updateSpyConfigWithAudit(
  pesos: SpyPesos,
  tolerancia: number,
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyConfigResult>> {
  return dispatchCore({
    action: "config_update",
    requireMutationEnabledImpl,
    requireAccessImpl,
    logActionImpl: logModuleAction,
    mutationImpl: () => updateSpyConfig(pesos, tolerancia, options),
    targetRefOf: () => "config:1",
    payload: { pesos, tolerancia },
  });
}
