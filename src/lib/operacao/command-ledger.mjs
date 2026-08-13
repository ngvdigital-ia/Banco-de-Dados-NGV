import { createHash } from "node:crypto";

export const IDEMPOTENCY_NEW = "new";
export const IDEMPOTENCY_REPLAY = "replay";
export const IDEMPOTENCY_CONFLICT = "conflict";

const SENSITIVE_KEY_PATTERN = /^(?:[A-Za-z0-9_-]*[-_.])?(token|secret|password|passwd|apikey|api_key|access_key|client_secret|authorization|auth|credential|cookie)(?:[-_.][A-Za-z0-9_-]*)?$/i;

const TOKEN_BOUNDARY = "(?<![A-Za-z0-9_-])";
const END_BOUNDARY = "(?![A-Za-z0-9_-])";

const SENSITIVE_VALUE_PATTERNS = Object.freeze([
  {
    kind: "jwt",
    regex: new RegExp(`${TOKEN_BOUNDARY}eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}${END_BOUNDARY}`),
  },
  {
    kind: "openai_key",
    regex: new RegExp(`${TOKEN_BOUNDARY}(?:sk|pk|rk)-[A-Za-z0-9]{20,}${END_BOUNDARY}`),
  },
  {
    kind: "aws_access_key",
    regex: new RegExp(`${TOKEN_BOUNDARY}AKIA[0-9A-Z]{16}${END_BOUNDARY}`),
  },
  {
    kind: "github_pat",
    regex: new RegExp(`${TOKEN_BOUNDARY}gh[pousr]_[A-Za-z0-9]{30,}${END_BOUNDARY}`),
  },
  {
    kind: "slack_token",
    regex: new RegExp(`${TOKEN_BOUNDARY}xox[abprs]-[A-Za-z0-9-]{10,}${END_BOUNDARY}`),
  },
  {
    kind: "bearer_token",
    regex: new RegExp(`${TOKEN_BOUNDARY}Bearer [A-Za-z0-9._~+/-]{20,}${END_BOUNDARY}`, "i"),
  },
  {
    kind: "private_key_block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    kind: "long_hex_secret",
    regex: new RegExp(`${TOKEN_BOUNDARY}[0-9a-f]{64}${END_BOUNDARY}`),
  },
]);

function canonicalStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value === undefined ? null : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const body = keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",");
  return `{${body}}`;
}

export function canonicalJson(value) {
  return canonicalStringify(value);
}

export function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function commandDigest(command) {
  return sha256Hex(canonicalJson(command));
}

export function classifyIdempotency({ existingHash, incomingHash }) {
  if (typeof existingHash !== "string") return IDEMPOTENCY_NEW;
  if (existingHash === incomingHash) return IDEMPOTENCY_REPLAY;
  return IDEMPOTENCY_CONFLICT;
}

function lookSensitiveIn(keyPath, value, findings) {
  if (SENSITIVE_KEY_PATTERN.test(keyPath.split(".").pop() ?? "")) {
    findings.hits.push({ path: keyPath, reason: "chave-sensivel" });
  }

  if (typeof value === "string") {
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      if (pattern.regex.test(value)) {
        findings.hits.push({ path: keyPath, reason: `valor-${pattern.kind}` });
        break;
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => lookSensitiveIn(`${keyPath}[${index}]`, item, findings));
    return;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      lookSensitiveIn(keyPath ? `${keyPath}.${key}` : key, child, findings);
    }
  }
}

export function detectSensitivePayload(command) {
  const findings = { hits: [] };
  lookSensitiveIn("", command, findings);
  const matches = findings.hits.slice(0, 10);
  return {
    sensitive: matches.length > 0,
    matches: matches.map((hit) => `${hit.reason}:${hit.path}`),
  };
}

export function sanitizeCommandId(commandId) {
  if (typeof commandId !== "string") return "unknown";
  const clean = commandId.replace(/[^a-zA-Z0-9._:-]/g, "_");
  return clean.length === 0 ? "unknown" : clean.slice(0, 128);
}