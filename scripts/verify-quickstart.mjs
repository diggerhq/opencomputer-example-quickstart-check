import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

// Run the guide itself in a new project. No corrected example lives here.
// --package is an explicit local-test override; unattended checks use the
// release URL from the guide, exactly as a new developer would.
const args = process.argv.slice(2);
const packageIndex = args.indexOf("--package");
const packageOverride = packageIndex < 0 ? undefined : args[packageIndex + 1];
if (packageIndex >= 0 && !packageOverride) throw new Error("--package requires a tarball path");
if (packageIndex >= 0) args.splice(packageIndex, 2);
if (args.length > 1 || args.some((arg) => arg.startsWith("--"))) {
  throw new Error("Usage: node scripts/verify-quickstart.mjs [guide.md] [--package local.tgz]");
}
const guidePath = resolve(args[0] ?? "docs/quickstart.md");
const guide = readFileSync(guidePath, "utf8");
const code = [...guide.matchAll(/```(?:javascript|js|mjs)\s*\n([\s\S]*?)```/g)];
if (code.length !== 1) throw new Error("The quickstart must contain one executable JavaScript block");
const expected = guide.match(/```text\s*\n([\s\S]*?)```/)?.[1]?.trim();
if (!expected) throw new Error("The quickstart must include its expected output in a text block");
const release = guide.match(/npm install\s+(https:\/\/[^\s`]+\.tgz)/)?.[1];
if (!release) throw new Error("The quickstart must install its released SDK tarball with npm install");
const dependency = packageOverride ? resolve(packageOverride) : release;
const directory = realpathSync(mkdtempSync(join(tmpdir(), "quickstart-check-")));
const redact = (text) => String(text ?? "").split(directory).join("<quickstart>");
try {
  console.log(`Guide: ${args[0] ?? "docs/quickstart.md"}`);
  console.log(`SDK: ${packageOverride ? "local test override" : release}`);
  writeFileSync(join(directory, "package.json"), JSON.stringify({ private: true, type: "module" }));
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    execFileSync(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund", dependency], {
      cwd: directory, encoding: "utf8", timeout: 120_000, stdio: "pipe",
    });
  } catch (error) {
    console.error("INSTALL FAILED");
    console.error(redact(error.stderr));
    process.exitCode = 2;
  }
  if (!process.exitCode) {
    writeFileSync(join(directory, "quickstart.mjs"), code[0][1]);
    const result = spawnSync(process.execPath, ["quickstart.mjs"], {
      cwd: directory, encoding: "utf8", timeout: 30_000,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(redact(result.stderr));
    if (result.error) console.error(redact(result.error.message));
    if (result.status !== 0) {
      console.error("QUICKSTART FAILED");
      process.exitCode = 1;
    } else if (result.stdout.trim() !== expected) {
      console.error(`OUTPUT MISMATCH\nExpected:\n${expected}`);
      process.exitCode = 1;
    } else {
      console.log("QUICKSTART PASSED — output matches the guide.");
    }
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
