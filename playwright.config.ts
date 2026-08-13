import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, ".auth/user.json");

export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  use: {
    baseURL: "https://banco-de-dados-ngv.vercel.app",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_FILE,
      },
    },
    {
      name: "chromium-no-auth",
      use: {
        ...devices["Desktop Chrome"],
      },
      testMatch: /full-test\.spec\.ts|app\.spec\.ts/,
    },
  ],
});
