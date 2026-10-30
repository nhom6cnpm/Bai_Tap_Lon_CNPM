import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const database =
  process.env.TASK9_UI_DATABASE_URL ||
  "postgresql://brewlite:brewlite@127.0.0.1:5432/brewlite_task9_ui_test";
if (!new URL(database).pathname.endsWith("_ui_test"))
  throw new Error("TASK9_UI_DATABASE_URL must end in _ui_test");

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:3200",
    browserName: "chromium",
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "win32" ? "msedge" : undefined),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "node test/start-task9-ui-server.cjs",
      cwd: path.resolve(__dirname, "../backend"),
      url: "http://127.0.0.1:3201/products",
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        DATABASE_URL: database,
        PORT: "3201",
        FRONTEND_URL: "http://127.0.0.1:3200",
        NODE_ENV: "production",
        JWT_SECRET: "task9-ui-test-jwt",
        ADMIN_EMAIL: "staff@task9-ui.test",
        ADMIN_PASSWORD: "StaffUiTest123",
        ORDER_PAYMENT_TIMEOUT_MINUTES: "15",
      },
    },
    {
      command:
        "node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3200",
      cwd: __dirname,
      url: "http://127.0.0.1:3200/login",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:3201",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3200",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
