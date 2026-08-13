import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const DRIZZLE_DIR = new URL("../drizzle/", import.meta.url);
const SQL_PATH = new URL("0009_clean_paibok.sql", DRIZZLE_DIR);
const JOURNAL_PATH = new URL("meta/_journal.json", DRIZZLE_DIR);
const SNAPSHOT_PATH = new URL("meta/0009_snapshot.json", DRIZZLE_DIR);

async function migrationSql() {
  return readFile(SQL_PATH, "utf8");
}

test("0009 gera os dois enums com todas as ações e status do contrato v1", async () => {
  const sql = await migrationSql();
  assert.match(sql, /CREATE TYPE "public"\."operation_command_action" AS ENUM\('consult', 'create', 'edit', 'comment', 'attach', 'complete', 'reopen', 'approve'\)/);
  assert.match(sql, /CREATE TYPE "public"\."operation_command_action" AS ENUM\([^)]*'create'[^)]*\)/);
  assert.match(sql, /CREATE TYPE "public"\."operation_command_status" AS ENUM\('accepted', 'queued', 'running', 'succeeded', 'divergent', 'waiting_human', 'failed'\)/);
});

test("0009 cria a tabela operation_commands com colunas e tipos esperados", async () => {
  const sql = await migrationSql();
  assert.match(sql, /CREATE TABLE "operation_commands" \(/);
  for (const column of [
    '"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL',
    '"command_id" text NOT NULL',
    '"offer_id" text NOT NULL',
    '"offer_tracking_id" integer',
    '"action" "operation_command_action" NOT NULL',
    '"actor_name" text NOT NULL',
    '"actor_clickup_user_id" text NOT NULL',
    '"operator_user_id" text NOT NULL',
    '"operator_email" text NOT NULL',
    '"payload" jsonb NOT NULL',
    '"payload_hash" text NOT NULL',
    '"status" "operation_command_status" DEFAULT \'accepted\' NOT NULL',
    '"requested_at" timestamp with time zone NOT NULL',
    '"created_at" timestamp with time zone DEFAULT now() NOT NULL',
    '"updated_at" timestamp with time zone DEFAULT now() NOT NULL',
  ]) {
    assert.match(sql, new RegExp(escapeRegExp(column)));
  }
});

test("0009 declara checks, unique, indexes e FK do ledger", async () => {
  const sql = await migrationSql();
  assert.match(sql, /CONSTRAINT "operation_commands_command_id_unique" UNIQUE\("command_id"\)/);
  assert.match(sql, /CONSTRAINT "operation_commands_command_id_length" CHECK \(length\("operation_commands"\."command_id"\) between 1 and 128\)/);
  assert.match(sql, /CONSTRAINT "operation_commands_actor_clickup_user_id" CHECK \("operation_commands"\."actor_clickup_user_id" ~ '\^\(PENDING\|\[0-9\]\+\)\$'\)/);
  const conditionalOfferCheck = 'CONSTRAINT "operation_commands_offer_id_ngv_slug" CHECK ("operation_commands"."offer_id" ~ \'^ngv:[a-z0-9]+(-[a-z0-9]+)*$\' OR ("operation_commands"."action" = \'consult\' AND "operation_commands"."offer_id" = \'PENDING\'))';
  assert.ok(sql.includes(conditionalOfferCheck), "offer_id deve aceitar slug ngv sempre ou PENDING apenas em consult");
  assert.doesNotMatch(sql, /CONSTRAINT "operation_commands_offer_id_ngv_slug" CHECK \("operation_commands"\."offer_id" ~ '[^']+'\)\,/);
  assert.match(sql, /CONSTRAINT "operation_commands_payload_hash_sha256" CHECK \("operation_commands"\."payload_hash" ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(sql, /ALTER TABLE "operation_commands" ADD CONSTRAINT "operation_commands_offer_tracking_id_offer_tracking_id_fk" FOREIGN KEY \("offer_tracking_id"\) REFERENCES "public"\."offer_tracking"\("id"\) ON DELETE restrict ON UPDATE no action/);
  for (const index of [
    'CREATE INDEX "operation_commands_offer_id_idx" ON "operation_commands" USING btree \("offer_id"\)',
    'CREATE INDEX "operation_commands_offer_tracking_id_idx" ON "operation_commands" USING btree \("offer_tracking_id"\)',
    'CREATE INDEX "operation_commands_status_idx" ON "operation_commands" USING btree \("status"\)',
    'CREATE INDEX "operation_commands_offer_id_status_idx" ON "operation_commands" USING btree \("offer_id","status"\)',
  ]) {
    assert.match(sql, new RegExp(escapeRegExp(index)));
  }
});

test("0009 não altera tabelas fora do operation_commands", async () => {
  const sql = await migrationSql();
  assert.doesNotMatch(sql, /ALTER TABLE "operation_commands" ADD COLUMN/);
  assert.ok((sql.match(/"operation_commands"/g) ?? []).length >= 1);
});

test("0009 está registrada no journal como pendente e não foi aplicada", async () => {
  const journal = JSON.parse(await readFile(JOURNAL_PATH, "utf8"));
  assert.equal(journal.version, "7");
  const entry = journal.entries[9];
  assert.ok(entry);
  assert.equal(entry.idx, 9);
  assert.equal(entry.tag, "0009_clean_paibok");
  const appliedCount = journal.entries.filter((item) => item && typeof item.applied === "boolean").length;
  assert.equal(appliedCount, 0, "journal não deve marcar migração como aplicada");
});

test("0009 mantém a mesma constraint condicional no snapshot do Drizzle", async () => {
  const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  const constraint = snapshot.tables["public.operation_commands"]?.checkConstraints?.operation_commands_offer_id_ngv_slug;
  assert.ok(constraint, "constraint operation_commands_offer_id_ngv_slug ausente no snapshot");
  assert.equal(
    constraint.value,
    '"operation_commands"."offer_id" ~ \'^ngv:[a-z0-9]+(-[a-z0-9]+)*$\' OR ("operation_commands"."action" = \'consult\' AND "operation_commands"."offer_id" = \'PENDING\')',
  );
});

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
