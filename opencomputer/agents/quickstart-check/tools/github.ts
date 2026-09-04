import { bearer, defineConnection, defineTool, useSecret } from "@opencomputer/agent";
import { findFix, proposeFix, type Request } from "./github-api.js";

// The compiler copies this literal policy into the deployment. The managed
// proxy attaches GITHUB_TOKEN outside the agent's VM. Keep the trailing slash.
export const github = defineConnection({
  id: "github",
  origin: "https://api.github.com",
  methods: ["GET", "POST"],
  pathPrefix: "/repos/diggerhq/opencomputer-example-quickstart-check/",
  headers: {
    Authorization: bearer(useSecret("GITHUB_TOKEN")),
    Accept: "application/vnd.github+json",
    "User-Agent": "opencomputer-example-quickstart-check",
  },
});

const request: Request = async (method, path, body) => {
  const response = await github.fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: response.status, json, text: text.slice(0, 1000) };
};

export const findExistingFix = defineTool({
  name: "find_existing_fix",
  description: "Look for the existing open quickstart fix PR in the fixed example repository. Call first on every run. Returns existing_pull_request, none, or failed. A failed lookup is not evidence that no PR exists.",
  input: { type: "object", properties: {}, additionalProperties: false },
  async run() { return findFix(request); },
});

export const openQuickstartFix = defineTool({
  name: "open_quickstart_fix",
  description: "Propose a verified correction to docs/quickstart.md in diggerhq/opencomputer-example-quickstart-check. Only this file can be written. Uses main and stable branch fix/quickstart; returns an existing PR on repeated runs. Never updates an existing branch. Supply actual before/after quickstart runner evidence with exit codes, and no private machine paths.",
  input: {
    type: "object",
    properties: {
      baseSha: { type: "string", description: "The full git rev-parse HEAD commit SHA used for both checks." },
      content: { type: "string", description: "The full corrected docs/quickstart.md content, preserving the released SDK installation and promised output." },
      explanation: { type: "string", description: "Concise diagnosed cause and correction. Do not invent evidence." },
      beforeOutput: { type: "string", description: "Actual failing runner exit code and relevant output, at most 4000 characters." },
      afterOutput: { type: "string", description: "Actual passing runner exit code and expected stdout, at most 4000 characters." },
    },
    required: ["baseSha", "content", "explanation", "beforeOutput", "afterOutput"],
    additionalProperties: false,
  },
  async run({ input }) { return proposeFix(request, input); },
});
