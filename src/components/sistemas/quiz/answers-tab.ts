import type { QuizAnalyticsMetadata } from "@/lib/sistemas/quiz/analytics-client.mjs";

/**
 * Respostas não são inferidas pelo tamanho da lista: o upstream pode retornar
 * definições de perguntas antes de existir um Quiz publicável. Um receipt local
 * nunca muda a identidade do funil selecionado e, por isso, não entra nesta
 * decisão.
 */
export function shouldShowAnswersTab(metadata: QuizAnalyticsMetadata) {
  return metadata.hasQuizAnswers === true;
}
