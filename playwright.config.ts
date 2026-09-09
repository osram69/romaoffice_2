import "dotenv/config";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", testMatch: ["website.spec.ts", "commerce.spec.ts"], workers: 1, timeout: 45000,
  use: { baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:3000", viewport: { width: 1440, height: 960 }, browserName: "chromium", trace: "retain-on-failure" },
  outputDir: "test-results/browser", reporter: "list",
});
