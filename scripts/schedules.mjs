import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// A small Development-only helper for the public API. The dashboard offers
// the same operations; the current CLI has no schedules subcommand.
const operation = process.argv[2] ?? "list";
const scheduleId = process.argv[3] ?? "morning-check";
if (!["list", "runs", "run"].includes(operation)) {
  throw new Error("Usage: node scripts/schedules.mjs list|runs|run [schedule-id]");
}
const binding = JSON.parse(await readFile(new URL("../.opencomputer/project.json", import.meta.url), "utf8"));
const config = JSON.parse(await readFile(
  process.env.OPENCOMPUTER_CONFIG ?? join(homedir(), ".opencomputer/config.json"), "utf8",
));
const apiUrl = new URL(process.env.OPENCOMPUTER_API_URL ?? "https://app.opencomputer.dev");
const origin = apiUrl.origin;
if (apiUrl.protocol !== "https:" || new URL(binding.apiUrl).origin !== origin) {
  throw new Error("The project binding must match the HTTPS API target");
}
const key = process.env.OPENCOMPUTER_API_KEY ?? (
  new URL(config.apiUrl ?? "https://app.opencomputer.dev").origin === origin ? config.apiKey : undefined
);
if (!key) throw new Error("Run opencomputer login for this API target first");
const params = new URLSearchParams({
  projectId: binding.projectId,
  agentId: "quickstart-check",
  environment: "development",
});
if (operation === "runs") params.set("scheduleId", scheduleId);
const route = operation === "runs" ? "schedule-runs"
  : operation === "run" ? `schedules/${encodeURIComponent(scheduleId)}/run` : "schedules";
const response = await fetch(`${origin}/api/managed-agents/${route}?${params}`, {
  method: operation === "run" ? "POST" : "GET",
  headers: { "x-api-key": key },
  redirect: "manual",
  signal: AbortSignal.timeout(60_000),
});
if (!response.ok) throw new Error(`Schedule API returned HTTP ${response.status}`);
console.log(JSON.stringify(await response.json(), null, 2));
