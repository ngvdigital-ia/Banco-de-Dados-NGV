export const isOperationCockpitEnabled =
  process.env.NEXT_PUBLIC_OPERATION_COCKPIT_ENABLED === "true";

// Flag server-side (não NEXT_PUBLIC) da Command API do corte 2B2-B.
// Guarda `typeof window === "undefined"` evita vazar/bundlar a env no client:
// no browser a expressão nem chega a avaliar process.env e resolve false.
export const isOperationCommandsEnabled =
  typeof window === "undefined" && process.env.OPERATION_COMMANDS_ENABLED === "true";

export const isOperationCommandDispatchEnabled =
  typeof window === "undefined" && process.env.OPERATION_COMMAND_DISPATCH_ENABLED === "true";

export const isOperationCommandStatusEnabled =
  typeof window === "undefined" && process.env.OPERATION_COMMAND_STATUS_ENABLED === "true";

export const isOperationQuizAnalyticsEnabled =
  typeof window === "undefined" && process.env.OPERATION_QUIZ_ANALYTICS_ENABLED === "true";

export const isOperationSpyAnalyticsEnabled =
  typeof window === "undefined" && process.env.OPERATION_SPY_ANALYTICS_ENABLED === "true";
