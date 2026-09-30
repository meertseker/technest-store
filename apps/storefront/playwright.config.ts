import { defineConfig, devices } from "@playwright/test"
import { existsSync, readFileSync } from "node:fs"

// Tests that talk to the backend need the same env as `next dev` (.env.local)
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
  }
}

// E2E_PORT lets parallel worktrees run their own server (default 8003)
const PORT = Number(process.env.E2E_PORT) || 8003
// A preinstalled Chromium when the bundled one isn't downloaded (cloud containers)
const executablePath = process.env.PW_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  // dev-mode server actions compile on first use; this machine is slow
  expect: { timeout: 15_000 },
  use: { baseURL: `http://localhost:${PORT}`, launchOptions: { executablePath } },
  projects: [
    {
      name: "mobile-375",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --turbopack -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
