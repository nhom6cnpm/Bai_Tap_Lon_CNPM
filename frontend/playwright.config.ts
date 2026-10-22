import { defineConfig, devices } from "@playwright/test";

const externalUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: externalUrl || "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    channel: "msedge",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "msedge" },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: "msedge",
      },
    },
  ],
  webServer: externalUrl
    ? undefined
    : {
        command: "node node_modules/next/dist/bin/next start --port 3100",
        url: "http://127.0.0.1:3100/demo/orders",
        reuseExistingServer: false,
        timeout: 120000,
      },
});
