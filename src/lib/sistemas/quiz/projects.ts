import "server-only";

import {
  fetchQuizDashboardProjects,
  provisionQuizDashboardProject,
} from "./projects-client.mjs";
import type {
  QuizDashboardProjectsResult,
  QuizDashboardProject,
  QuizProvisionedProject,
  QuizProvisionInput,
  QuizTrackerInstallation,
} from "./projects-client.mjs";

// A única ponte que lê credenciais. Este arquivo só entra pela cadeia de
// Server Actions; os valores não são NEXT_PUBLIC e não são aceitos do caller.
const credentials = () => ({
  username: process.env.QUIZ_DASHBOARD_USERNAME ?? "",
  password: process.env.QUIZ_DASHBOARD_PASSWORD ?? "",
});

export function listQuizDashboardProjects(): Promise<
  QuizDashboardProjectsResult<{ provisioningEnabled: boolean; projects: QuizDashboardProject[] }>
> {
  return fetchQuizDashboardProjects(credentials());
}

export function provisionQuizDashboardProjectServer(
  input: QuizProvisionInput,
): Promise<
  QuizDashboardProjectsResult<{ project: QuizProvisionedProject; installation: QuizTrackerInstallation }>
> {
  return provisionQuizDashboardProject(input, credentials());
}
