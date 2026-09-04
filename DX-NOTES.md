# DX notes

Dated evidence from building and running the quickstart-check example.
Only completed observations belong here; plans and claims awaiting validation
remain in the README or the examples workstream.

## 2026-09-04 — Local fixture

The packed `@parceldesk/sdk@2.0.0` installs in a clean temporary project.
The stale guide calls `.map` on its paginated response and fails with
`TypeError: orders.map is not a function`. An independently corrected example
prints both expected orders. The fixture tests also exercise pagination and
invalid inputs. This is local fixture evidence, not a live agent result.

## 2026-09-04 — Automatic schedule produced a verified fix

Published the example and the installable fixture under
[SDK release 2.0.0](https://github.com/diggerhq/opencomputer-example-quickstart-check/releases/tag/sdk-v2.0.0).
The original guide fails when installing that release URL, without a local
package override. Source base: `cb8c314eea81511a4c4eb341fb89e093b94a146d`.

With CLI 0.6.7 and authoring package 0.5.2, deployed the `quickstart-check`
project to Development with a temporary two-minute schedule. At
**22:24 UTC**, the scheduler created an automatic (`manual: false`) run and
session `d38f7ad9-3422-4d2e-8a72-52b5cbeea226`. No Run now call was used.

The session checked for an existing PR, cloned the public repository,
installed the release, reproduced the TypeError, inspected the installed
implementation and types, changed one line of the guide, and verified the
expected output after another clean install. It opened
[PR #1](https://github.com/diggerhq/opencomputer-example-quickstart-check/pull/1),
then completed successfully at 22:26:16 UTC. Execution took 130 seconds over
16 model steps. Model: `anthropic/claude-sonnet-5`.

PR commit `55184420e5509f89e943df203f0fa533247742f3` changes only
`docs/quickstart.md`. An independent local run of that exact PR guide against
the published release also passed. Both GitHub check runs passed, including
[the strict quickstart check](https://github.com/diggerhq/opencomputer-example-quickstart-check/actions/runs/33925479531).

The **22:26 UTC** occurrence was recorded as skipped while the first turn was
still running. The public API returned the generic message "The scheduled
run could not be started" rather than the specific overlap reason. The
outcome and timeline establish the skip; the wording could be clearer.

At **22:28 UTC**, a second automatic occurrence created a fresh session,
`24c0dee4-4360-4a4d-9f47-6908940f6210`. Its only tool call was
`find_existing_fix`, which returned PR #1. The turn completed at 22:28:17 UTC
without cloning, opening a PR, or making an authenticated GitHub write.
The repository still had exactly one PR.

After verification, restored the weekday definition and redeployed it to
Development. Schedule inspection returned `status: "manual"`; both test
sessions were ended and their runtimes reported `terminated`. Production was
not deployed. The API still shows a calculated `nextRunAt` for a manual-only
schedule; activation status determines whether it recurs.

## 2026-09-04 — Setup and verification details

The current CLI compiles schedules but has no schedule operation commands.
`scripts/schedules.mjs` calls the public API using the saved CLI login to list
Development schedules, inspect runs, or invoke Run now. It was used to inspect
the automatic run above.

The authoring doctor requires a blank `GITHUB_TOKEN=` declaration in
`opencomputer/.env.example`. The token was uploaded separately to the project's
Development secret store, restricted to the GitHub API origin. Doctor's
missing local Development value warning is expected when credentials are
held on the platform; it passes with zero errors.

CI keeps the intentional failure on the demonstration base. A PR changing the
guide must pass the strict release-based check; other PRs run the SDK and tool
suite without being forced to repair the fixture. Fork tests derive their
repository URLs from configuration and permit a fork-hosted fixture release.

## 2026-09-04 — Repeated deployment scans its own generated runtime

The second deploy stopped with `doctor_failed`: `tool_location_invalid` and
`tool_name_duplicate` under the compiler-generated
`opencomputer/agents/quickstart-check/.opencomputer/runtime/`. This is the
same issue recorded in the CI resolver example's DX note 005; it remains
present in CLI 0.6.7.

`scripts/clean-generated.mjs` removes only that reproducible runtime directory
before `npm run deploy` and `npm run doctor`. It leaves project bindings and
credentials untouched. Redeployment then succeeded and switched Development
back to manual-only. No platform code change was needed for this example.
