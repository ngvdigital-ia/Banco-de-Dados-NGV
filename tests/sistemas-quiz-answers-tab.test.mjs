import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowAnswersTab } from "../src/components/sistemas/quiz/answers-tab.ts";

test("metadata false mantém Perguntas e respostas oculta mesmo com 14 definições", () => {
  const fourteenDefinitions = Array.from({ length: 14 }, (_, index) => ({ id: `question-${index}` }));
  assert.equal(fourteenDefinitions.length, 14);
  assert.equal(shouldShowAnswersTab({ hasQuizAnswers: false, quizAnswersCount: fourteenDefinitions.length }), false);
});

test("metadata true mostra Perguntas e respostas", () => {
  assert.equal(shouldShowAnswersTab({ hasQuizAnswers: true, quizAnswersCount: 0 }), true);
});

test("receipt transitório de Quiz recém-criado mostra a aba sem persistir formato", () => {
  assert.equal(shouldShowAnswersTab({ hasQuizAnswers: false, quizAnswersCount: 0 }, "quiz"), true);
  assert.equal(shouldShowAnswersTab({ hasQuizAnswers: false, quizAnswersCount: 14 }, "vsl"), false);
});
