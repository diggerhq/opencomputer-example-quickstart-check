import type { DataValue } from "@opencomputer/agent";

// These are intentionally not tool parameters. Even a malformed model call
// cannot use these tools to publish another file or target another repository.
export const repository = "diggerhq/opencomputer-example-quickstart-check";
export const base = "main";
export const guide = "docs/quickstart.md";
export const branch = "fix/quickstart";
const root = `/repos/${repository}`;
const shaPattern = /^[a-f0-9]{40}$/;

type Json = Record<string, unknown>;
export type ApiResult = { status: number; json: unknown; text: string };
export type Request = (method: "GET" | "POST", path: string, body?: Json) => Promise<ApiResult>;

function record(value: unknown): Json {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function failure(step: string, result: ApiResult): DataValue {
  return { outcome: "failed", step, status: result.status, error: result.text.slice(0, 1000) };
}

function pullResult(value: unknown, outcome: string): DataValue | undefined {
  const pull = record(value);
  // Only expose a URL that GitHub returned for this repository's pull request.
  if (typeof pull.number !== "number" || !Number.isInteger(pull.number) || pull.number <= 0) return;
  const url = `https://github.com/${repository}/pull/${pull.number}`;
  if (pull.html_url !== url) return;
  return { outcome, url, number: pull.number };
}

export async function findFix(request: Request): Promise<DataValue> {
  const owner = repository.split("/")[0];
  const query = `state=open&base=${base}&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=1`;
  const result = await request("GET", `${root}/pulls?${query}`);
  if (result.status !== 200 || !Array.isArray(result.json)) return failure("find-pull", result);
  if (result.json.length === 0) return { outcome: "none" };
  return pullResult(result.json[0], "existing_pull_request")
    ?? { outcome: "failed", step: "find-pull", error: "GitHub returned an invalid pull request." };
}

function hasOutcome(value: DataValue, outcome: string): boolean {
  return record(value).outcome === outcome;
}

type FixInput = { baseSha: string; content: string; explanation: string; beforeOutput: string; afterOutput: string };

function validate(input: Record<string, unknown>): FixInput | string {
  if (typeof input.baseSha !== "string" || !shaPattern.test(input.baseSha)) return "baseSha must be a full lowercase Git commit SHA.";
  for (const [key, max] of [["content", 65536], ["explanation", 4000], ["beforeOutput", 4000], ["afterOutput", 4000]] as const) {
    if (typeof input[key] !== "string" || !input[key].trim() || input[key].length > max || input[key].includes("\0")) {
      return `${key} must be a non-empty string of at most ${max} characters without null bytes.`;
    }
  }
  return input as FixInput;
}

function evidenceBlock(text: string): string {
  // Indented code safely preserves logs containing Markdown fences.
  return text.split("\n").map(line => `    ${line}`).join("\n");
}

function bodyFor(input: FixInput): string {
  return `The scheduled quickstart check reproduced a failure in \`${guide}\` against the released ParcelDesk SDK. ParcelDesk is a deliberately constructed example fixture.

${input.explanation}

Verification command, run before and after the documentation change in separate fresh projects:

    node scripts/verify-quickstart.mjs docs/quickstart.md

Before:

${evidenceBlock(input.beforeOutput)}

After:

${evidenceBlock(input.afterOutput)}

Only \`${guide}\` is changed. The SDK release and expected result are preserved.
`;
}

function shaAt(value: unknown, key: string): string | undefined {
  const sha = record(value)[key];
  return typeof sha === "string" && shaPattern.test(sha) ? sha : undefined;
}

async function readBranch(request: Request): Promise<ApiResult> {
  return request("GET", `${root}/git/ref/heads/${branch}`);
}

// A previous attempt may have created the ref and then lost the PR response.
// Reuse it only if it is exactly the requested single-file change. Never
// overwrite an existing branch, including a closed/merged PR's old branch.
async function verifyExistingBranch(request: Request, ref: ApiResult, input: FixInput): Promise<DataValue | undefined> {
  if (ref.status !== 200) return failure("read-existing-ref", ref);
  const commitSha = shaAt(record(ref.json).object, "sha");
  if (!commitSha) return { outcome: "failed", step: "read-existing-ref", error: "Invalid ref SHA." };

  const comparison = await request("GET", `${root}/compare/${input.baseSha}...${commitSha}`);
  if (comparison.status !== 200) return failure("compare-existing-ref", comparison);
  const compared = record(comparison.json);
  const files = compared.files;
  if (compared.status !== "ahead" || compared.total_commits !== 1 || !Array.isArray(files)
    || files.length !== 1 || record(files[0]).filename !== guide || record(files[0]).status !== "modified") {
    return { outcome: "branch_conflict", branch, error: "Existing branch is not a single quickstart-only commit above this base. It was left unchanged." };
  }

  const file = await request("GET", `${root}/contents/${guide}?ref=${commitSha}`);
  if (file.status !== 200) return failure("read-existing-guide", file);
  const json = record(file.json);
  let content = "";
  try {
    if (json.encoding === "base64" && typeof json.content === "string") {
      const bytes = Uint8Array.from(atob(json.content.replace(/\s/g, "")), char => char.charCodeAt(0));
      content = new TextDecoder().decode(bytes);
    }
  } catch { /* Invalid API content cannot be used for a recovery. */ }
  if (content !== input.content) return { outcome: "branch_conflict", branch, error: "Existing branch has different guide contents. It was left unchanged." };
}

async function createPull(request: Request, input: FixInput): Promise<DataValue> {
  // Also resolves a race with another producer immediately before publishing.
  const existing = await findFix(request);
  if (!hasOutcome(existing, "none")) return existing;

  const pull = await request("POST", `${root}/pulls`, {
    title: "Fix the ParcelDesk SDK quickstart",
    body: bodyFor(input),
    head: branch,
    base,
  });
  if (pull.status === 201) {
    return pullResult(pull.json, "created_pull_request")
      ?? { outcome: "failed", step: "pull", error: "GitHub returned an invalid pull request." };
  }
  if (pull.status === 409 || pull.status === 422) {
    const raced = await findFix(request);
    if (hasOutcome(raced, "existing_pull_request")) return raced;
  }
  return failure("pull", pull);
}

export async function proposeFix(request: Request, rawInput: Record<string, unknown>): Promise<DataValue> {
  const input = validate(rawInput);
  if (typeof input === "string") return { outcome: "invalid_input", error: input };

  const existing = await findFix(request);
  if (!hasOutcome(existing, "none")) return existing;

  // The agent verifies a specific main commit. If main moves, a new check is
  // required rather than presenting evidence from a different base as current.
  const main = await request("GET", `${root}/git/ref/heads/${base}`);
  if (main.status !== 200) return failure("base-ref", main);
  if (shaAt(record(main.json).object, "sha") !== input.baseSha) {
    return { outcome: "base_moved", error: "main changed after verification. Run the check again on the current base." };
  }

  const ref = await readBranch(request);
  if (ref.status === 200) {
    const conflict = await verifyExistingBranch(request, ref, input);
    return conflict ?? createPull(request, input);
  }
  if (ref.status !== 404) return failure("read-ref", ref);

  const baseCommit = await request("GET", `${root}/git/commits/${input.baseSha}`);
  if (baseCommit.status !== 200) return failure("base-commit", baseCommit);
  const baseTreeSha = shaAt(record(baseCommit.json).tree, "sha");
  if (!baseTreeSha) return { outcome: "failed", step: "base-commit", error: "Invalid base tree SHA." };

  const blob = await request("POST", `${root}/git/blobs`, { content: input.content, encoding: "utf-8" });
  const blobSha = shaAt(blob.json, "sha");
  if (blob.status !== 201 || !blobSha) return failure("blob", blob);
  const tree = await request("POST", `${root}/git/trees`, {
    base_tree: baseTreeSha,
    tree: [{ path: guide, mode: "100644", type: "blob", sha: blobSha }],
  });
  const treeSha = shaAt(tree.json, "sha");
  if (tree.status !== 201 || !treeSha) return failure("tree", tree);
  const commit = await request("POST", `${root}/git/commits`, {
    message: "Fix the ParcelDesk SDK quickstart",
    tree: treeSha,
    parents: [input.baseSha],
  });
  const commitSha = shaAt(commit.json, "sha");
  if (commit.status !== 201 || !commitSha) return failure("commit", commit);

  const createdRef = await request("POST", `${root}/git/refs`, { ref: `refs/heads/${branch}`, sha: commitSha });
  if (createdRef.status !== 201) {
    if (createdRef.status !== 409 && createdRef.status !== 422) return failure("ref", createdRef);
    const raced = await findFix(request);
    if (!hasOutcome(raced, "none")) return raced;
    const conflict = await verifyExistingBranch(request, await readBranch(request), input);
    if (conflict) return conflict;
  }
  return createPull(request, input);
}
