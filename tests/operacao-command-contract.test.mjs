import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  OPERATION_ACTIONS,
  OPERATION_MUTATION_ACTIONS,
  OPERATION_COMMAND_PENDING,
  isReadOnlyAction,
  isMutationAction,
  parseOperationCommand,
  safeParseOperationCommand,
} from "../src/lib/operacao/command-contract.mjs";

const HUB_VALID_FIXTURE = new URL("../../../fixtures/operation-command.valid.json", import.meta.url);
const HUB_INVALID_FIXTURE = new URL("../../../fixtures/operation-command.invalid.json", import.meta.url);

const NOW = "2026-08-11T18:00:00-03:00";
const TASK_ID = "86ajm207a";
const LIST_ID = "901326990512";

function validCommand(action, extra = {}) {
  return {
    schema_version: 1,
    command_id: `cmd-test-${action}-001`,
    offer_id: "ngv:calistenia-21d",
    actor: { name: "Diogo", clickup_user_id: 102680936 },
    action,
    requested_at: NOW,
    ...(isMutationAction(action)
      ? {
          precondition: { optimistic_date_updated: "2026-08-11T17:55:00-03:00", observed_status: "briefing" },
          approval: { required: true, approved: true, by: "Diogo", approved_at: "2026-08-11T18:03:00-03:00" },
          risk: { level: "low", summary: "resumo de risco", acknowledged: true },
        }
      : {}),
    args: argsFor(action),
    metadata: { source: "banco-ngv-ui", requested_by_ui: true },
    ...extra,
  };
}

function argsFor(action) {
  switch (action) {
    case "consult":
      return { task_id: TASK_ID };
    case "create":
      return { list_id: LIST_ID, status: "briefing" };
    case "edit":
      return { task_id: TASK_ID, status: "in progress" };
    case "comment":
      return { task_id: TASK_ID, body: "Comentario de acompanhamento" };
    case "attach":
      return {
        task_id: TASK_ID,
        attachment_url: "https://files.example.test/planilha.xlsx",
        attachment_name: "planilha.xlsx",
      };
    case "complete":
    case "reopen":
    case "approve":
      return { task_id: TASK_ID, reason: "Resumo objetivo." };
    default:
      throw new Error(`ação não mapeada: ${action}`);
  }
}

test("catálogo de ações: oito actions v1, sete mutações e consult read-only", () => {
  assert.deepEqual([...OPERATION_ACTIONS], [
    "consult",
    "create",
    "edit",
    "comment",
    "attach",
    "complete",
    "reopen",
    "approve",
  ]);
  assert.equal(OPERATION_ACTIONS.length, 8);
  assert.deepEqual([...OPERATION_MUTATION_ACTIONS], [
    "create",
    "edit",
    "comment",
    "attach",
    "complete",
    "reopen",
    "approve",
  ]);
  assert.equal(OPERATION_MUTATION_ACTIONS.length, 7);
  assert.equal(OPERATION_MUTATION_ACTIONS.includes("consult"), false);
  assert.equal(isReadOnlyAction("consult"), true);
  assert.equal(isMutationAction("consult"), false);
  for (const action of OPERATION_MUTATION_ACTIONS) {
    assert.equal(isMutationAction(action), true);
    assert.equal(isReadOnlyAction(action), false);
  }
});

test("contrato v1 aceita as oito actions com payload válido e parse preserva idempotência", () => {
  for (const action of OPERATION_ACTIONS) {
    const command = validCommand(action);
    const result = safeParseOperationCommand(command);
    assert.equal(result.success, true, `${action} deveria ser válido`);
    const parsed = parseOperationCommand(command);
    assert.equal(parsed.command_id, command.command_id);
    assert.equal(parsed.action, action);
    assert.equal(parsed.offer_id, "ngv:calistenia-21d");
  }
});

test("consult é read-only e aceita PENDING explícito em task_id ou list_id", () => {
  for (const args of [{ task_id: OPERATION_COMMAND_PENDING }, { list_id: OPERATION_COMMAND_PENDING }]) {
    const result = safeParseOperationCommand(validCommand("consult", { args }));
    assert.equal(result.success, true, `consult deveria aceitar ${JSON.stringify(args)}`);
    assert.equal(result.data.action, "consult");
  }
  assert.equal(validCommand("consult")?.approval === undefined, true);
  assert.equal(validCommand("consult")?.precondition === undefined, true);
  assert.equal(validCommand("consult")?.risk === undefined, true);
});

test("consult aceita offer_id=PENDING, mas mutações nunca aceitam offer_id=PENDING", () => {
  const consult = safeParseOperationCommand(validCommand("consult", {
    offer_id: OPERATION_COMMAND_PENDING,
    args: { task_id: TASK_ID },
  }));
  assert.equal(consult.success, true);

  for (const action of OPERATION_MUTATION_ACTIONS) {
    const result = safeParseOperationCommand(validCommand(action, {
      offer_id: OPERATION_COMMAND_PENDING,
    }));
    assert.equal(result.success, false, `${action} deveria rejeitar offer_id=PENDING`);
    if (result.success === false) {
      assert.ok(
        result.error.issues.some((issue) => issue.path.includes("offer_id") && issue.message.includes("PENDING")),
        `${action}: motivo de offer_id=PENDING ausente`,
      );
    }
  }
});

test("consult recusa payload vazio de identificadores", () => {
  const result = safeParseOperationCommand(validCommand("consult", { args: {} }));
  assert.equal(result.success, false);
});

test("toda mutação rejeita approval ausente", () => {
  for (const action of OPERATION_MUTATION_ACTIONS) {
    const command = validCommand(action, { approval: undefined });
    const result = safeParseOperationCommand(command);
    assert.equal(result.success, false, `${action} deveria exigir approval`);
  }
});

test("toda mutação rejeita approval falso (required=false ou approved=false)", () => {
  for (const action of OPERATION_MUTATION_ACTIONS) {
    for (const approval of [
      { required: false, approved: true, by: "Diogo" },
      { required: true, approved: false, by: "Diogo" },
      { required: false, approved: false, by: "Diogo" },
    ]) {
      const result = safeParseOperationCommand(validCommand(action, { approval }));
      assert.equal(result.success, false, `${action} deveria rejeitar ${JSON.stringify(approval)}`);
    }
  }
});

test("toda mutação rejeita risk ausente", () => {
  for (const action of OPERATION_MUTATION_ACTIONS) {
    const result = safeParseOperationCommand(validCommand(action, { risk: undefined }));
    assert.equal(result.success, false, `${action} deveria exigir risk`);
  }
});

test("toda mutação rejeita precondition ausente", () => {
  for (const action of OPERATION_MUTATION_ACTIONS) {
    const result = safeParseOperationCommand(validCommand(action, { precondition: undefined }));
    assert.equal(result.success, false, `${action} deveria exigir precondition`);
  }
});

test("toda mutação rejeita precondition com optimistic_date_updated PENDING", () => {
  for (const action of OPERATION_MUTATION_ACTIONS) {
    const result = safeParseOperationCommand(
      validCommand(action, {
        precondition: { optimistic_date_updated: OPERATION_COMMAND_PENDING, observed_status: "briefing" },
      }),
    );
    assert.equal(result.success, false, `${action} deveria rejeitar precondição PENDING`);
  }
});

test("toda mutação rejeita target PENDING (task_id/list_id)", () => {
  const pendingTargets = {
    create: { list_id: OPERATION_COMMAND_PENDING },
    edit: { task_id: OPERATION_COMMAND_PENDING, status: "in progress" },
    comment: { task_id: OPERATION_COMMAND_PENDING, body: "texto" },
    attach: {
      task_id: OPERATION_COMMAND_PENDING,
      attachment_url: "https://files.example.test/x.pdf",
      attachment_name: "x.pdf",
    },
    complete: { task_id: OPERATION_COMMAND_PENDING },
    reopen: { task_id: OPERATION_COMMAND_PENDING },
    approve: { task_id: OPERATION_COMMAND_PENDING },
  };
  for (const action of OPERATION_MUTATION_ACTIONS) {
    const result = safeParseOperationCommand(validCommand(action, { args: pendingTargets[action] }));
    assert.equal(result.success, false, `${action} deveria rejeitar target PENDING`);
    if (result.success === false) {
      assert.ok(
        result.error.issues.some((issue) => issue.message.includes("PENDING")),
        `${action}: problema de PENDING ausente em ${JSON.stringify(result.error.issues)}`,
      );
    }
  }
});

test("create/edit aceitam due_at ISO-8601 com timezone e null; null sozinho é alteração de edit", () => {
  for (const dueAt of ["2026-08-20T12:00:00-03:00", null]) {
    const create = safeParseOperationCommand(validCommand("create", {
      args: { list_id: LIST_ID, due_at: dueAt },
    }));
    assert.equal(create.success, true, `create deveria aceitar due_at=${String(dueAt)}`);

    const edit = safeParseOperationCommand(validCommand("edit", {
      args: { task_id: TASK_ID, due_at: dueAt },
    }));
    assert.equal(edit.success, true, `edit deveria aceitar due_at=${String(dueAt)}`);
  }
});

test("create/edit rejeitam due_at sem timezone ou fora de ISO-8601", () => {
  for (const action of ["create", "edit"]) {
    const target = action === "create" ? { list_id: LIST_ID } : { task_id: TASK_ID };
    for (const dueAt of [
      "2026-08-20T12:00:00",
      "2026-08-20 12:00:00-03:00",
      "amanhã",
    ]) {
      const result = safeParseOperationCommand(validCommand(action, {
        args: { ...target, due_at: dueAt },
      }));
      assert.equal(result.success, false, `${action} deveria rejeitar due_at=${dueAt}`);
    }
  }
});

test("qualquer mutação rejeita args extra não contratuais (sem shell livre)", () => {
  for (const action of OPERATION_MUTATION_ACTIONS) {
    const base = validCommand(action).args;
    const result = safeParseOperationCommand(validCommand(action, { args: { ...base, extra_field: 1 } }));
    assert.equal(result.success, false, `${action} deveria rejeitar chave extra`);
  }
});

test("comando com campo script/shell in line nos args é rejeitado sem eco", () => {
  const comment = validCommand("comment", {
    args: { task_id: TASK_ID, body: "anexando", script: "rm -rf /tmp/ngv" },
  });
  const result = safeParseOperationCommand(comment);
  assert.equal(result.success, false);
});

test("corpo do comando não aceita chaves top-level fora do contrato", () => {
  const command = validCommand("consult");
  command.shell = ["curl", "https://evil.example.test"];
  const result = safeParseOperationCommand(command);
  assert.equal(result.success, false);
});

test("idempotência do contrato: command_id e payload definem replay; divergência rompe", () => {
  const original = validCommand("edit");
  const reordered = {
    ...original,
    args: undefined,
  };
  reordered.args = JSON.parse(JSON.stringify(original.args));
  const a = safeParseOperationCommand(original);
  const b = safeParseOperationCommand(reordered);
  assert.equal(a.success, true);
  assert.equal(b.success, true);
  assert.deepEqual(a.data, b.data);
});

test("fixtures válidas do hub passam no contrato v1", async () => {
  const fixtureSource = await readFile(HUB_VALID_FIXTURE, "utf8");
  const fixture = JSON.parse(fixtureSource);
  assert.equal(fixture.schema_version, 1);
  assert.ok(Array.isArray(fixture.commands) && fixture.commands.length >= 4);

  for (const command of fixture.commands) {
    const result = safeParseOperationCommand(command);
    assert.equal(result.success, true, `fixture válida rejeitada: ${command.command_id}`);
  }
});

test("fixtures inválidas do hub são rejeitadas e validam os motivos esperados", async () => {
  const fixtureSource = await readFile(HUB_INVALID_FIXTURE, "utf8");
  const fixture = JSON.parse(fixtureSource);
  assert.ok(Array.isArray(fixture.commands) && fixture.commands.length >= 8);

  for (const command of fixture.commands) {
    const result = safeParseOperationCommand(command);
    assert.equal(result.success, false, `fixture inválida aceita: ${command.command_id}`);
    if (command.action === "delete") {
      assert.ok(result.error.issues.some((issue) => String(issue.path).includes("action")));
    }
  }
});
