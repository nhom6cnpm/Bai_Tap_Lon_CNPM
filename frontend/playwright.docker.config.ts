import { execFileSync } from "node:child_process";
import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

// This profile never starts/resets the real stack. Verify the isolated containers first.
const docker = process.env.DOCKER_EXE || "docker";
interface TestContainer {
  Config: { Env: string[]; Image: string };
  HostConfig: {
    PortBindings: Record<string, { HostIp: string; HostPort: string }[]>;
  };
}
function inspect(
  name: string,
  containerPort: string,
  hostPort: string,
): TestContainer {
  const rows = JSON.parse(
    execFileSync(docker, ["inspect", name], { encoding: "utf8" }),
  ) as TestContainer[];
  const row = rows[0];
  const bindings = row?.HostConfig.PortBindings[containerPort];
  if (
    !row ||
    !bindings?.some(
      (binding) =>
        binding.HostIp === "127.0.0.1" && binding.HostPort === hostPort,
    )
  )
    throw new Error(
      `Docker UI checks require isolated localhost port ${hostPort} on ${name}`,
    );
  if (!row.Config.Env.includes("NODE_ENV=production"))
    throw new Error("Docker UI checks require production images");
  return row;
}
const backend = inspect("brewlite-handoff-ui-backend", "3001/tcp", "3201");
const databaseUrl = backend.Config.Env.find((value) =>
  value.startsWith("DATABASE_URL="),
)?.slice("DATABASE_URL=".length);
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_ui_test"))
  throw new Error("Refusing Docker UI checks against a non-test database");
const actual = execFileSync(
  docker,
  [
    "exec",
    "brewlite-handoff-ui-backend",
    "node",
    "-e",
    "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();try{console.log((await c.query('SELECT current_database() AS name')).rows[0].name)}finally{await c.end()}})().catch(()=>{process.exitCode=1})",
  ],
  { encoding: "utf8" },
).trim();
if (actual !== new URL(databaseUrl).pathname.slice(1))
  throw new Error("Unexpected database behind the Docker UI API");
const frontend = inspect("brewlite-handoff-ui-frontend", "3000/tcp", "3200");
if (frontend.Config.Image !== "brewlite-handoff-ui-frontend")
  throw new Error("Use the dedicated frontend image built for ports 3200/3201");

export default defineConfig({ ...config, webServer: undefined });
