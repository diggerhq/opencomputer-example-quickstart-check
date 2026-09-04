# Quickstart check

An [OpenComputer](https://docs.opencomputer.dev/agents/schedules) agent that
runs an SDK quickstart every weekday and opens a PR when the instructions
need fixing.

The fixture is a small fictional SDK, ParcelDesk. Its v2 release returns
`{ items, nextCursor }` from `orders.list()`, but the
[quickstart](docs/quickstart.md) still calls `.map()` on the response. Following
the guide with the released package fails with `TypeError: orders.map is not
a function`.

The agent reproduced that failure, inspected the installed SDK, and opened
[PR #1](https://github.com/diggerhq/opencomputer-example-quickstart-check/pull/1)
with a one-line correction and passing test output. A later scheduled run
found the open PR and stopped. The broken guide is kept on `main` so you can
reproduce both sides.

## Schedule

[`morning-check.ts`](opencomputer/agents/quickstart-check/schedules/morning-check.ts)
registers the job when you deploy:

```ts
import { defineSchedule } from "@opencomputer/agent";

export default defineSchedule({
  id: "morning-check",
  cron: "0 9 * * 1-5",
  timezone: "Europe/London",
  enabled: ["production"],
  overlap: "skip",
  dispatch: {
    text: "Follow our published SDK quickstart in a clean project. If it fails, propose a verified documentation fix.",
    payload: {
      mode: "quickstart-check",
      repository: "diggerhq/opencomputer-example-quickstart-check",
      base: "main",
      guide: "docs/quickstart.md",
    },
  },
});
```

OpenComputer keeps the timer outside the agent's VM. Each occurrence starts a
fresh session with this input and the schedule's run ID and intended time.
`overlap: "skip"` prevents a new run while the previous one is active. Changes
to the schedule take effect on redeploy.

[`agent.ts`](opencomputer/agents/quickstart-check/agent.ts) selects the coding
harness's shell and filesystem tools, plus two GitHub tools. The agent clones
the repository, runs the guide, investigates any failure, edits the Markdown,
and runs it again before proposing a fix. Installation failures are reported
without a documentation change.

[`verify-quickstart.mjs`](scripts/verify-quickstart.mjs) creates an empty
project, installs the release URL from the guide, executes its JavaScript
block, and compares stdout with its expected output. The model supplies the
diagnosis and edit; the script just runs the example and checks the result.

The [GitHub tools](opencomputer/agents/quickstart-check/tools/github.ts) use a
managed connection scoped to the repository. The token stays outside the VM.
The publishing tool writes only `docs/quickstart.md` and checks for an existing
PR on `fix/quickstart` before creating one. That check uses GitHub, since
scheduled sessions share neither conversation history nor files.

## Run it

You need Node 22+, an OpenComputer account, and a fork of this repository.

```sh
git clone https://github.com/YOUR-ACCOUNT/opencomputer-example-quickstart-check.git
cd opencomputer-example-quickstart-check
npm ci
npm run verify:quickstart
```

The last command should fail with the TypeError above. It installs the
[SDK release tarball](https://github.com/diggerhq/opencomputer-example-quickstart-check/releases/tag/sdk-v2.0.0)
from GitHub; the fixture is not published to npm and needs no service account.
The same command passes on the agent's fix PR.

Replace `diggerhq/opencomputer-example-quickstart-check` with your fork's
`owner/repo` throughout `opencomputer/`, then commit and push those changes.
This sets the clone target, GitHub tools, connection scope, and schedule input.
Keep the trailing slash in the connection's `pathPrefix`. Leave the release
URL in the guide pointing to this repository unless you publish your own SDK
release.

Create a fine-grained GitHub token with Contents and Pull requests read/write
on your fork, then deploy:

```sh
npm run typecheck
npm test
npm run doctor
npx opencomputer login
npx opencomputer link --create-project quickstart-check
npx opencomputer secrets set GITHUB_TOKEN --environment development \
  --allow-origin https://api.github.com --value-stdin < /path/to/github-token
npm run deploy
```

`npm run deploy` targets Development. The schedule is manual there by default;
open **Development → Schedules → Run now** and follow the linked session.
It should open a fix PR with the failing and passing output. Run it again and
it should return that same PR.

You can also use the included helper, which uses your saved CLI login and
targets Development:

```sh
node scripts/schedules.mjs list
node scripts/schedules.mjs run
node scripts/schedules.mjs runs
```

## Run on a timer

For a short test or recording, change two fields in `morning-check.ts`:

```ts
cron: "*/2 * * * *",
enabled: ["development"],
```

Run `npm run deploy`. The Schedules view shows the next occurrence and links
each run to its session. An existing fix PR will make the agent stop early;
use a fresh fork to record the full investigation. To repeat it in the same
fork, close the previous PR and delete `fix/quickstart` first—the tool will
never overwrite that branch.

When finished, restore the weekday cron and `enabled: ["production"]`, then
run `npm run deploy` again. Development returns to manual-only. This command
does not deploy to Production.

The original example's Development deployment is currently manual-only.
[DX-NOTES.md](DX-NOTES.md) records the automatic runs and overlap skip.

## Working on the example

`npm test` covers the SDK contract and GitHub tools. It passes on both the
deliberately broken guide and a correct fix. `npm run verify:quickstart` is the
strict check: it must fail on the original guide and pass on the corrected
one. PRs changing the guide run both checks in CI.

To test changes to the SDK without publishing a release:

```sh
npm run package:sdk
npm run verify:quickstart -- --package artifacts/parceldesk-sdk-2.0.0.tgz
```

The package script creates the tarball attached to the `sdk-v2.0.0` GitHub
release. Scheduled runs always use the guide's release URL.

Use the repository's `deploy` and `doctor` scripts. They remove generated
runtime files before invoking CLI 0.6.7, which otherwise scans its own build
output as source. Project bindings and credentials are left alone.

Schedule history reports dispatch status: `enacted` means a turn was queued.
Read the session for the check's actual outcome. Failed runs are not retried
automatically. See [DX-NOTES.md](DX-NOTES.md) for the live verification and
remaining platform issues.

MIT.
