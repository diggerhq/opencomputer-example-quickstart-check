import { rm } from "node:fs/promises";

// CLI 0.6.7's doctor scans its previous generated runtime as source. Remove
// only this reproducible build output, never project bindings or credentials.
await rm(new URL("../opencomputer/agents/quickstart-check/.opencomputer/runtime/", import.meta.url), {
  recursive: true,
  force: true,
});
