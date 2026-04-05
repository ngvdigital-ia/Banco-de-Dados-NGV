/**
 * Parse a comma-separated URL param into an array of non-empty strings.
 * Works in both server and client contexts.
 */
export function parseMultiParam(
  param: string | string[] | undefined
): string[] {
  if (param === undefined || param === null) return [];
  const raw = Array.isArray(param) ? param.join(",") : param;
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
