/**
 * Compute { from, to } based on a period string.
 * Server-compatible (no "use client").
 */
export function getDateRange(period: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "today": {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return { from, to };
    }
    case "7d": {
      const from = new Date(to);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "15d": {
      const from = new Date(to);
      from.setDate(from.getDate() - 14);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "30d": {
      const from = new Date(to);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { from, to };
    }
    case "all":
    default:
      return { from: new Date(2020, 0, 1), to };
  }
}
