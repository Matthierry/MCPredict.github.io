import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "live-beta.spec.ts",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "https://beta.mcpredict.com",
    headless: true,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
});
