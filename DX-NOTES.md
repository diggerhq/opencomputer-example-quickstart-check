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
