import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const expectedOutput = "ord_1042: Ada Lovelace ($49.00)\nord_1043: Grace Hopper ($125.00)\n";
let project;
let ParcelDesk;

before(async () => {
  const { stdout } = await run(process.execPath, [path.join(root, "scripts/package-sdk.mjs")]);
  const tarball = stdout.trim();
  assert.equal(path.basename(tarball), "parceldesk-sdk-2.0.0.tgz");

  project = await mkdtemp(path.join(os.tmpdir(), "parceldesk-consumer-"));
  await writeFile(path.join(project, "package.json"), JSON.stringify({ private: true, type: "module" }));
  await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: project });
  const sdk = await import(pathToFileURL(path.join(project, "node_modules/@parceldesk/sdk/src/index.js")).href);
  ParcelDesk = sdk.ParcelDesk;
});

after(async () => {
  if (project) await rm(project, { recursive: true, force: true });
});

test("the released package returns a paginated response with the promised first orders", async () => {
  const client = new ParcelDesk({ workspace: "demo" });
  const response = await client.orders.list({ limit: 2 });
  assert.equal(Array.isArray(response), false);
  assert.deepEqual(response.items.map(({ id, customer, totalCents }) => ({ id, customer, totalCents })), [
    { id: "ord_1042", customer: "Ada Lovelace", totalCents: 4900 },
    { id: "ord_1043", customer: "Grace Hopper", totalCents: 12500 },
  ]);
  assert.equal(typeof response.nextCursor, "string");
});

test("following cursors reads every order once and finishes with a null cursor", async () => {
  const client = new ParcelDesk();
  const ids = [];
  let cursor = null;
  for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
    const page = await client.orders.list({ limit: 1, cursor });
    ids.push(...page.items.map((order) => order.id));
    cursor = page.nextCursor;
    if (cursor === null) break;
  }
  assert.equal(cursor, null, "pagination should terminate");
  assert.deepEqual(ids, ["ord_1042", "ord_1043", "ord_1044", "ord_1045"]);
  assert.equal(new Set(ids).size, ids.length);
});

test("invalid pagination inputs fail instead of silently repeating or skipping a page", async () => {
  const client = new ParcelDesk();
  for (const limit of [0, -1, 1.5, 101, "2"]) {
    await assert.rejects(client.orders.list({ limit }), /limit must be an integer/);
  }
  await assert.rejects(client.orders.list({ cursor: "missing-order" }), /Invalid orders cursor/);
});

test("consumer changes to returned orders cannot corrupt subsequent checks", async () => {
  const client = new ParcelDesk();
  const first = await client.orders.list();
  first.items[0].customer = "Changed by consumer";
  first.items.pop();
  const next = await client.orders.list();
  assert.equal(next.items.length, 2);
  assert.equal(next.items[0].customer, "Ada Lovelace");
});

test("the historical array assumption reproduces the onboarding TypeError", async () => {
  const script = path.join(project, "stale-example.mjs");
  await writeFile(script, `
import { ParcelDesk } from "@parceldesk/sdk";
const client = new ParcelDesk({ workspace: "demo" });
const orders = await client.orders.list({ limit: 2 });
console.log(orders.map((order) => order.id).join("\\n"));
`);
  await assert.rejects(run(process.execPath, [script], { cwd: project }), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /TypeError: orders\.map is not a function/);
    return true;
  });
});

test("using the documented v2 response contract produces the expected output", async () => {
  const script = path.join(project, "compatible-example.mjs");
  await writeFile(script, `
import { ParcelDesk } from "@parceldesk/sdk";
const client = new ParcelDesk({ workspace: "demo" });
const { items: orders } = await client.orders.list({ limit: 2 });
console.log(orders.map((order) => order.id + ": " + order.customer + " ($" + (order.totalCents / 100).toFixed(2) + ")").join("\\n"));
`);
  const { stdout, stderr } = await run(process.execPath, [script], { cwd: project });
  assert.equal(stdout, expectedOutput);
  assert.equal(stderr, "");
});

test("the actual quickstart is runnable and either reproduces known drift or verifies its fix", async () => {
  const markdown = await readFile(path.join(root, "docs/quickstart.md"), "utf8");
  const snippets = [...markdown.matchAll(/^```(?:javascript|js)\r?\n([\s\S]*?)^```/gm)];
  assert.equal(snippets.length, 1, "keep a single copy-and-paste JavaScript example");
  const outputs = [...markdown.matchAll(/^```text\r?\n([\s\S]*?)^```/gm)];
  assert.equal(outputs.length, 1);
  assert.equal(outputs[0][1], expectedOutput);
  assert.match(markdown, /npm install https:\/\/github\.com\/diggerhq\/opencomputer-example-quickstart-check\/releases\/download\/sdk-v2\.0\.0\/parceldesk-sdk-2\.0\.0\.tgz/);

  const script = path.join(project, "quickstart.mjs");
  await writeFile(script, snippets[0][1]);
  let result;
  try {
    result = await run(process.execPath, [script], { cwd: project });
  } catch (error) {
    // The demo base is deliberately stale. A docs-fix PR must also keep this
    // fixture suite green; verify:quickstart separately requires a passing run.
    assert.equal(error.code, 1);
    assert.match(error.stderr, /TypeError: orders\s*\.map is not a function/);
    return;
  }
  assert.equal(result.stdout, expectedOutput);
  assert.equal(result.stderr, "");
});
