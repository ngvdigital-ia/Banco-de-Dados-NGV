const SEVERITY_RANK = Object.freeze({ BLOCKED: 0, ATTENTION: 1, PENDING: 2 });

/** Ordena exceções por severidade, evidência mais antiga e identidade estável. */
export function compareBlockerRows(left, right) {
  const severity = (SEVERITY_RANK[left.blocker.severity] ?? 99) - (SEVERITY_RANK[right.blocker.severity] ?? 99);
  if (severity !== 0) return severity;

  const leftTime = left.blocker.occurred_at ? Date.parse(left.blocker.occurred_at) : Number.POSITIVE_INFINITY;
  const rightTime = right.blocker.occurred_at ? Date.parse(right.blocker.occurred_at) : Number.POSITIVE_INFINITY;
  if (leftTime !== rightTime) return leftTime - rightTime;

  const name = left.offer.display_name.localeCompare(right.offer.display_name, "pt-BR");
  if (name !== 0) return name;
  return left.blocker.code.localeCompare(right.blocker.code, "pt-BR");
}
