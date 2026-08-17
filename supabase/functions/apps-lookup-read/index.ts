// Edge function apps-lookup-read (NGV Core) — expõe o lookup de acesso por e-mail
// para o painel Banco NGV, sem que o painel toque no Supabase Apps.
//
// Estrutura copiada de apps-purchase-access (padrão canônico de ingress do Core):
// POST único, header privado x-ngv-core-key → sha256 → validate_ngv_core_ingress,
// service key vinda de SUPABASE_SECRET_KEYS.
//
// Diferenças em relação a apps-purchase-access, e só elas:
//   * payload é exatamente { email: string } (1 chave, 3..320 chars, com "@");
//   * chama read_apps_lookup_by_email e devolve o jsonb da RPC inalterado;
//   * a credencial de ingress é `banco_writer` — a credencial do Core é POR SISTEMA,
//     nunca compartilhada; o Spy tem a dele (spy_writer), o Banco tem esta.
//
// O e-mail recebido NUNCA é registrado — nem em caminho de erro. Por isso não existe
// nenhuma chamada de log neste arquivo: erro vira código genérico, sem eco do payload.

import { createClient } from "npm:@supabase/supabase-js@2";

const json = (status: number, value: Record<string, boolean | string | object>) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8" } });

function secret(name: string): string | null {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const value = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)[name] : null;
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch { return null; }
}
async function sha256(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function payload(value: unknown): value is { email: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 1
    && typeof record.email === "string"
    && record.email.length >= 3 && record.email.length <= 320
    && record.email.includes("@");
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = secret("banco_writer");
const supabase = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (supabase === null) return json(500, { error: "server_error" });
  const ingressKey = request.headers.get("x-ngv-core-key");
  if (!ingressKey) return json(401, { error: "unauthorized" });
  const { data: valid, error: authError } = await supabase.rpc("validate_ngv_core_ingress", {
    p_token_sha256: await sha256(ingressKey),
  });
  if (authError || valid !== true) return json(401, { error: "unauthorized" });

  let value: unknown;
  try { value = await request.json(); } catch { return json(400, { error: "invalid_payload" }); }
  if (!payload(value)) return json(400, { error: "invalid_payload" });

  const { data, error } = await supabase.rpc("read_apps_lookup_by_email", { p_email: value.email });
  if (error) return json(500, { error: "server_error" });
  // A RPC sempre devolve jsonb (e-mail sem correspondência é resolved:false, não null).
  // null aqui seria quebra de contrato — vira 500 em vez de virar 200 vazio silencioso.
  if (data === null) return json(500, { error: "server_error" });
  return json(200, data as Record<string, boolean | object>);
});
