import type { QuizAnalyticsMetadata } from "@/lib/sistemas/quiz/analytics-client.mjs";

/**
 * Respostas não são inferidas pelo tamanho da lista: o upstream pode retornar
 * definições de perguntas antes de existir um Quiz publicável. A única exceção
 * é o receipt local de um Quiz criado nesta sessão, que ainda precisa expor a
 * aba para orientar a primeira instalação.
 */
export function shouldShowAnswersTab(metadata: QuizAnalyticsMetadata, createdFormat?: "quiz" | "vsl" | "presell") {
  return metadata.hasQuizAnswers === true || createdFormat === "quiz";
}
