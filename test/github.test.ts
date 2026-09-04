import assert from "node:assert/strict";
import test from "node:test";
import { base, branch, findFix, proposeFix, repository, type Request } from "../opencomputer/agents/quickstart-check/tools/github-api.js";

const repo = `/repos/${repository}`;
const owner = repository.split("/")[0];
const pulls = `${repo}/pulls?state=open&base=${base}&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=1`;
const baseSha = "a".repeat(40);
const treeSha = "b".repeat(40);
const blobSha = "c".repeat(40);
const nextTreeSha = "d".repeat(40);
const commitSha = "e".repeat(40);
const input = {
  baseSha,
  content: "# Corrected guide\n\nReleased SDK and expected output remain unchanged.\n",
  explanation: "The documented access pattern did not match the released SDK.",
  beforeOutput: "Exit 1\nTypeError: orders.map is not a function\nQUICKSTART FAILED",
  afterOutput: "Exit 0\nord_1042: Ada Lovelace ($49.00)\nord_1043: Grace Hopper ($125.00)\nQUICKSTART PASSED — output matches the guide.",
};
const pull = { number: 7, html_url: `https://github.com/${repository}/pull/7` };
type Step = { method: "GET" | "POST"; path: string; status: number; json: unknown; inspect?: (body: Record<string, unknown> | undefined) => void };

function fake(steps: Step[]) {
  let index = 0;
  const request: Request = async (method, path, body) => {
    const step = steps[index++];
    assert.ok(step, `Unexpected request ${method} ${path}`);
    assert.equal(method, step.method);
    assert.equal(path, step.path);
    step.inspect?.(body);
    return { status: step.status, json: step.json, text: JSON.stringify(step.json) };
  };
  return { request, done: () => assert.equal(index, steps.length, "All expected requests must occur") };
}

const empty: Step = { method: "GET", path: pulls, status: 200, json: [] };
const main: Step = { method: "GET", path: `${repo}/git/ref/heads/${base}`, status: 200, json: { object: { sha: baseSha } } };
const existing: Step = { method: "GET", path: pulls, status: 200, json: [pull] };
const ref: Step = { method: "GET", path: `${repo}/git/ref/heads/${branch}`, status: 200, json: { object: { sha: commitSha } } };
const creation: Step[] = [
  empty, main,
  { ...ref, status: 404, json: { message: "Not Found" } },
  { method: "GET", path: `${repo}/git/commits/${baseSha}`, status: 200, json: { tree: { sha: treeSha } } },
  { method: "POST", path: `${repo}/git/blobs`, status: 201, json: { sha: blobSha }, inspect: body => {
    assert.deepEqual(body, { content: input.content, encoding: "utf-8" });
  } },
  { method: "POST", path: `${repo}/git/trees`, status: 201, json: { sha: nextTreeSha }, inspect: body => {
    assert.deepEqual(body, { base_tree: treeSha, tree: [{ path: "docs/quickstart.md", mode: "100644", type: "blob", sha: blobSha }] });
  } },
  { method: "POST", path: `${repo}/git/commits`, status: 201, json: { sha: commitSha }, inspect: body => {
    assert.deepEqual(body?.parents, [baseSha]);
    assert.equal(body?.tree, nextTreeSha);
  } },
  { method: "POST", path: `${repo}/git/refs`, status: 201, json: { object: { sha: commitSha } }, inspect: body => {
    assert.deepEqual(body, { ref: `refs/heads/${branch}`, sha: commitSha });
  } },
];
const publish: Step = { method: "POST", path: `${repo}/pulls`, status: 201, json: pull, inspect: body => {
  assert.equal(body?.head, branch);
  assert.equal(body?.base, base);
  assert.match(String(body?.body), /deliberately constructed example fixture/);
  assert.ok(String(body?.body).includes(input.beforeOutput.split("\n").map(line => `    ${line}`).join("\n")));
  assert.ok(String(body?.body).includes("QUICKSTART PASSED"));
} };
const comparison: Step = { method: "GET", path: `${repo}/compare/${baseSha}...${commitSha}`, status: 200, json: {
  status: "ahead", total_commits: 1, files: [{ filename: "docs/quickstart.md", status: "modified" }],
} };
const contents: Step = { method: "GET", path: `${repo}/contents/docs/quickstart.md?ref=${commitSha}`, status: 200, json: {
  encoding: "base64", content: Buffer.from(input.content).toString("base64"),
} };

test("an existing open fix returns its URL without creating Git objects", async () => {
  const api = fake([existing]);
  assert.deepEqual(await proposeFix(api.request, input), { outcome: "existing_pull_request", url: pull.html_url, number: 7 });
  api.done();
});

test("failed PR lookup stops the run; it is never treated as an empty result", async () => {
  const api = fake([{ ...empty, status: 403, json: { message: "Forbidden" } }]);
  assert.equal((await proposeFix(api.request, input) as any).outcome, "failed");
  api.done();
});

test("invalid commit or oversized guide is rejected before any network request", async () => {
  const api = fake([]);
  assert.equal((await proposeFix(api.request, { ...input, baseSha: "main" }) as any).outcome, "invalid_input");
  assert.equal((await proposeFix(api.request, { ...input, content: "x".repeat(65537) }) as any).outcome, "invalid_input");
  api.done();
});

test("a changed main requires a new verification, with no Git mutations", async () => {
  const api = fake([empty, { ...main, json: { object: { sha: "f".repeat(40) } } }]);
  assert.equal((await proposeFix(api.request, input) as any).outcome, "base_moved");
  api.done();
});

test("the created PR changes only the fixed guide and contains actual evidence", async () => {
  const api = fake([...creation, empty, publish]);
  const result = await proposeFix(api.request, { ...input, repository: "other/repo", path: "sdk/index.js", branch: "main" });
  assert.deepEqual(result, { outcome: "created_pull_request", url: pull.html_url, number: 7 });
  api.done();
});

test("a concurrent ref creation returns the winner's PR without a duplicate", async () => {
  const steps = creation.map(step => step.path === `${repo}/git/refs` ? { ...step, status: 422, json: { message: "Reference already exists" } } : step);
  const api = fake([...steps, existing]);
  assert.equal((await proposeFix(api.request, input) as any).outcome, "existing_pull_request");
  api.done();
});

test("a concurrent PR creation returns the winner's PR", async () => {
  const api = fake([...creation, empty, { ...publish, status: 422, json: { message: "A pull request already exists" } }, existing]);
  assert.equal((await proposeFix(api.request, input) as any).outcome, "existing_pull_request");
  api.done();
});

test("a matching orphaned branch can recover without creating another commit", async () => {
  const api = fake([empty, main, ref, comparison, contents, empty, publish]);
  assert.equal((await proposeFix(api.request, input) as any).outcome, "created_pull_request");
  api.done();
});

test("an existing branch that changes SDK code cannot be reused or overwritten", async () => {
  const api = fake([empty, main, ref, { ...comparison, json: {
    status: "ahead", total_commits: 1, files: [{ filename: "sdk/index.js", status: "modified" }],
  } }]);
  assert.equal((await proposeFix(api.request, input) as any).outcome, "branch_conflict");
  api.done();
});

test("a different correction on the stable branch is left unchanged", async () => {
  const api = fake([empty, main, ref, comparison, { ...contents, json: {
    encoding: "base64", content: Buffer.from("A different fix").toString("base64"),
  } }]);
  assert.equal((await proposeFix(api.request, input) as any).outcome, "branch_conflict");
  api.done();
});

test("untrusted PR response URLs are not reported as a verified fix", async () => {
  const api = fake([{ ...existing, json: [{ number: 7, html_url: "https://example.com/unrelated" }] }]);
  assert.equal((await findFix(api.request) as any).outcome, "failed");
  api.done();
});
