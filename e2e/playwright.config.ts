import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

const testDir = defineBddConfig({
  features: ["./features/**/*.feature"],
  steps: ["./steps/**/*.ts"],
});

export default defineConfig({
  testDir,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./global/setup.ts",
  globalTeardown: "./global/teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
