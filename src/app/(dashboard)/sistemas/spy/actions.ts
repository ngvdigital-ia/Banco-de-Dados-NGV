"use server";

import { revalidatePath } from "next/cache";
import {
  createSpyOfertaWithAudit,
  deleteSpyLeituraWithAudit,
  deleteSpyOfertaWithAudit,
  saveSpyLeiturasBatchWithAudit,
  updateSpyConfigWithAudit,
  updateSpyLeituraWithAudit,
  updateSpyOfertaWithAudit,
} from "@/lib/sistemas/spy/mutations";
import type {
  SpyCreateOfertaInput,
  SpyLeituraItemInput,
  SpyPesos,
  SpyUpdateOfertaPatch,
} from "@/lib/sistemas/spy/mutations-client.mjs";

// Camada fina "use server" em cima de src/lib/sistemas/spy/mutations.ts — mesmo motivo de
// tags/actions.ts (única forma de um Client Component chamar código server-only sem passar por
// uma API route). Nenhuma lógica nova aqui: `mutations.ts` já faz authz (requireModuleAccess) +
// auditoria (logModuleAction) + validação; este arquivo só (1) chama a função certa e (2)
// revalida a rota em caso de sucesso, pra `router.refresh()` no client trazer dado fresco do Spy
// em vez do painel ficar com o estado antigo depois de escrever.
//
// NUNCA mexe em SpyMutationOptions (origin/password/timeoutMs/fetchImpl) — produção usa sempre os
// defaults de mutations-client.mjs (env SPY_DASHBOARD_PASSWORD). Testes de escrita real batem
// direto em mutations-dispatch.mjs/mutations-client.mjs com stub, nunca passando por este arquivo
// (ver tests/sistemas-spy-mutations-*.test.mjs) — Server Action não é unit-testável sem runtime
// Next, então este arquivo fica deliberadamente sem lógica própria pra não precisar ser testado
// isoladamente.

const SPY_PATH = "/sistemas/spy";

export async function criarSpyOfertaAction(input: SpyCreateOfertaInput) {
  const result = await createSpyOfertaWithAudit(input);
  if (result.kind === "success") revalidatePath(SPY_PATH);
  return result;
}

export async function editarSpyOfertaAction(id: string, patch: SpyUpdateOfertaPatch) {
  const result = await updateSpyOfertaWithAudit(id, patch);
  if (result.kind === "success") revalidatePath(SPY_PATH);
  return result;
}

export async function removerSpyOfertaAction(id: string) {
  const result = await deleteSpyOfertaWithAudit(id);
  if (result.kind === "success") revalidatePath(SPY_PATH);
  return result;
}

export async function salvarSpyLeiturasLoteAction(itens: SpyLeituraItemInput[]) {
  const result = await saveSpyLeiturasBatchWithAudit(itens);
  if (result.kind === "success") revalidatePath(SPY_PATH);
  return result;
}

export async function editarSpyLeituraAction(id: string, ads: number) {
  const result = await updateSpyLeituraWithAudit(id, ads);
  if (result.kind === "success") revalidatePath(SPY_PATH);
  return result;
}

export async function removerSpyLeituraAction(id: string) {
  const result = await deleteSpyLeituraWithAudit(id);
  if (result.kind === "success") revalidatePath(SPY_PATH);
  return result;
}

export async function atualizarSpyConfigAction(pesos: SpyPesos, tolerancia: number) {
  const result = await updateSpyConfigWithAudit(pesos, tolerancia);
  if (result.kind === "success") revalidatePath(SPY_PATH);
  return result;
}
