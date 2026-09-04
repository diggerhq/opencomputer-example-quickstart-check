# Quickstart check example

This repository owns a runnable OpenComputer Serverless Agents example: a
scheduled agent follows an SDK quickstart in a clean project, verifies a
failure, and proposes a tested documentation fix. The ParcelDesk SDK is a
deliberately constructed fixture, not a real customer's broken SDK.

- `README.md` owns setup, the demonstration, and verified outcomes.
- `DX-NOTES.md` owns dated live experiments and product friction.
- `opencomputer/` owns the agent, schedule, and managed GitHub connection.
- `sdk/` owns the fixture SDK; `docs/quickstart.md` is intentionally stale on
  the demonstration base branch. Do not repair it outside the agent's fix PR.
- `test/` and `scripts/` own repeatable local verification and packaging.
- The cross-example workstream lives in the sibling knowledge repository,
  `serverless-agents-ws/.agents/work/021-examples-workstream.md`.

Never commit credentials, local bindings, generated artifacts, or session
logs. Never print secret values or source environment files. Never force-push.
Preserve unrelated work. Run typecheck, fixture/tool tests, and the authoring
doctor before deploying. Use only this example's explicitly named Development
project for live validation; no Production deployment. Disable Development
recurrence after validation so unattended runs do not continue accidentally.
Do not claim timed execution, a passing fix, or deduplication without evidence.
