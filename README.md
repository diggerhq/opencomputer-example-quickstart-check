# Quickstart check

An OpenComputer Serverless Agent that checks an SDK's getting-started guide
every weekday morning. It installs the released SDK in a fresh project,
executes the guide, and opens a verified documentation fix when the instructions
fail. Subsequent runs find the existing fix PR instead of opening duplicates.

## The problem

A quickstart can stop working after an SDK release even when nobody changes
the documentation. This agent is responsible for trying the onboarding steps
regularly and producing a concrete fix when they drift.

This repository includes a fictional **ParcelDesk** SDK and its quickstart.
The SDK release works, but the quickstart on `main` deliberately contains an
outdated assumption. The agent discovers the mismatch by running the example
and inspecting the installed package. No real customer data or API key is
needed by the fixture.

## A schedule is part of the deployment

The agent's schedule lives in
[`opencomputer/agents/quickstart-check/schedules/morning-check.ts`](opencomputer/agents/quickstart-check/schedules/morning-check.ts):

```ts
export default defineSchedule({
  id: "morning-check",
  cron: "0 9 * * 1-5",
  timezone: "Europe/London",
  enabled: ["production"],
  overlap: "skip",
  dispatch: {
    text: "Check that the published ParcelDesk quickstart works.",
    payload: {
      mode: "quickstart-check",
      repository: "diggerhq/opencomputer-example-quickstart-check",
      base: "main",
      guide: "docs/quickstart.md",
    },
  },
});
```

Deploying registers the schedule along with the agent. OpenComputer keeps the
timer outside the agent's computer, then starts a fresh session for each run.
The agent receives the dispatch plus the intended time and run ID. The
schedule skips an occurrence if a previous run is still active.

Development exposes **Run now** by default. To test actual recurrence, opt
Development into the schedule explicitly. Each run has a new conversation and
workspace; GitHub's open PRs provide the cross-run record for duplicate checks.

## What the agent does

1. Check for an existing open quickstart fix PR.
2. Clone the repository and read the published quickstart.
3. Install the release tarball referenced by that guide in a clean project.
4. Run the guide's actual JavaScript and compare its output with the documented
   result.
5. If it fails, inspect the installed SDK, make a focused change to the guide,
   and rerun the corrected instructions in another clean project.
6. Open a PR changing only `docs/quickstart.md`, with the observed error and
   successful verification. Healthy runs and already-reported failures produce
   no new PR.

The model does the diagnosis and edit. The verification script extracts the
actual example from Markdown; it contains no replacement snippet or fix.
GitHub writes use a managed connection scoped to this repository. The agent's
computer never receives the GitHub token.

## Run the example

Requires Node 22+, an OpenComputer account, and a GitHub repository you own.

```sh
git clone https://github.com/diggerhq/opencomputer-example-quickstart-check.git
cd opencomputer-example-quickstart-check
npm ci
npm run typecheck
npm test
npm run doctor
```

To propose fixes to your own fork, change the repository in `agent.ts`, the
`repository` constant in `tools/github-api.ts`, the connection `pathPrefix` in
`tools/github.ts`, and the schedule payload. Keep the connection's path prefix
exact, including its trailing slash. The fixture release URL can remain pointed
at this repository, or you can publish the SDK in your own fork.

```sh
npx opencomputer login
npx opencomputer link --create-project quickstart-check
npx opencomputer deploy --alias development
npx opencomputer secrets set GITHUB_TOKEN --environment development \
  --allow-origin https://api.github.com --value-stdin < /path/to/github-token
```

Use a fine-grained token with Contents and Pull requests read/write on the
target repository. Store the token outside this checkout. Do not include it
in a schedule, prompt, or shell command argument.

Open the project's **Development → Schedules** view and choose **Run now**.
Follow the linked session through reproduction, diagnosis, verification, and
the resulting PR. Run it again to observe the existing-PR check.

The current CLI does not expose schedule operations. This repository includes
a small Development-only helper using the public API and your existing CLI
login:

```sh
node scripts/schedules.mjs list
node scripts/schedules.mjs run
node scripts/schedules.mjs runs
```

## Record an automatic run

For a short recording, change the schedule to:

```ts
cron: "*/2 * * * *",
enabled: ["development"],
```

Deploy to Development again. Show the next run in Schedules, let the scheduled
time arrive, and follow the new session. The run history distinguishes an
automatic occurrence from **Run now**. Record one subsequent occurrence to
show that it finds the existing PR.

After recording, restore the weekday schedule and `enabled: ["production"]`,
then redeploy **to Development**. This makes Development manual-only again;
it does not deploy or enable anything in Production.

For a repeatable recording, use a fresh fork or deliberately reset your own
demonstration's fix branch and PR. Never merge the fix into this repository's
demonstration base merely to reset a run.

## Verify the fixture independently

The strict check installs the published release and runs the guide. It should
fail on the deliberately stale demonstration base and pass on the agent's fix:

```sh
npm run verify:quickstart
```

For local SDK development, package and install the local tarball explicitly:

```sh
npm run package:sdk
npm run verify:quickstart -- --package artifacts/parceldesk-sdk-2.0.0.tgz
```

`npm test` checks the SDK contract, the historical failure, and tool behavior.
It stays green on both the demonstration base and the corrected guide. Fix
PRs additionally run the strict check in GitHub Actions against the release.

The SDK release is built with `npm run package:sdk` and attached to the
`sdk-v2.0.0` GitHub release. It is a real installable package, distributed as a
GitHub release asset rather than published to the npm registry.

## Limits

- The example reads a public repository and currently checks one guide, one
  SDK release, and one expected output. It is not a general documentation crawler.
- Schedule history records dispatch outcomes. `enacted` means the turn was
  queued; the linked session shows whether the check actually succeeded.
- Failed runs are inspectable but are not automatically retried by the scheduler.
- A fresh scheduled session does not resume the previous run's files or history.
- The example reserves `fix/quickstart` for its single outstanding correction.
  It never overwrites an existing branch. After closing or merging a fix,
  remove that branch explicitly before demonstrating another new correction.
- The fixture deliberately models documentation drift. Real-world installation
  outages should be reported as outages, not "fixed" by rewriting the guide.

[`DX-NOTES.md`](DX-NOTES.md) records the observed live runs and any product gaps.
See the OpenComputer [schedules guide](https://docs.opencomputer.dev/agents/schedules)
for the authoring contract.

MIT.
