import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = path.join(root, "artifacts");
await mkdir(artifacts, { recursive: true });

const { stdout } = await run("npm", [
  "pack",
  "--ignore-scripts",
  "--json",
  "--pack-destination", artifacts,
], {
  cwd: path.join(root, "sdk"),
  maxBuffer: 1024 * 1024,
});

const packages = JSON.parse(stdout);
if (packages.length !== 1 || packages[0].name !== "@parceldesk/sdk" || packages[0].version !== "2.0.0") {
  throw new Error("Expected exactly one @parceldesk/sdk@2.0.0 release tarball.");
}

// The only stdout is the absolute tarball path, for scripts and release upload.
console.log(path.join(artifacts, packages[0].filename));
