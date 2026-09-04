# ParcelDesk SDK fixture

`@parceldesk/sdk` is a fictional, deterministic SDK used by the OpenComputer
quickstart check example. It runs entirely in the current Node.js process:
there is no ParcelDesk service, network call, authentication, or customer data.

Version 2.0.0 exposes `new ParcelDesk({ workspace: "demo" }).orders.list()`.
The asynchronous method accepts `{ limit, cursor }` and returns
`{ items, nextCursor }`. Pass the returned cursor into the next call to read
another page. A `null` cursor means there are no further pages.

The default page size is two orders; limits must be integers from 1 to 100.
There are four fixed orders in the demo workspace. Each order has an `id`,
`customer`, `totalCents`, and `currency`. Returned objects are independent
copies, so changing a response does not alter later calls.

The repository's public quickstart represents older instructions that have
drifted behind this version. This fixture lets the scheduled agent discover
and verify the mismatch without depending on an external outage or a real
SDK regression. See the repository README for the demonstration workflow.
