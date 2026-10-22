import { defineConfig, devices } from "@playwright/test";

// Browser walkthrough of the demo, on a phone and a laptop viewport.
// Locally: `npx playwright install chromium` once, then `npm run build && npm run e2e`.
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: { baseURL: "http://localhost:3100" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 }, launchOptions } },
  ],
  webServer: { command: "npx next start -p 3100", url: "http://localhost:3100", reuseExistingServer: true },
});
