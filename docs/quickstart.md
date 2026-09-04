# ParcelDesk JavaScript quickstart

Print the two most recent orders from the ParcelDesk demo workspace in a few
minutes. You need Node.js 20 or later and npm.

## Create a project

Start in an empty directory and install the current SDK release:

```sh
mkdir parceldesk-quickstart
cd parceldesk-quickstart
npm init -y
npm install https://github.com/diggerhq/opencomputer-example-quickstart-check/releases/download/sdk-v2.0.0/parceldesk-sdk-2.0.0.tgz
```

## List your orders

Create a file named `quickstart.mjs`:

```javascript
import { ParcelDesk } from "@parceldesk/sdk";

const client = new ParcelDesk({ workspace: "demo" });
const orders = await client.orders.list({ limit: 2 });

console.log(
  orders
    .map((order) => `${order.id}: ${order.customer} ($${(order.totalCents / 100).toFixed(2)})`)
    .join("\n"),
);
```

Run the example:

```sh
node quickstart.mjs
```

You should see these two orders:

```text
ord_1042: Ada Lovelace ($49.00)
ord_1043: Grace Hopper ($125.00)
```

The demo workspace is included in the SDK, so no account or API key is needed.

---

ParcelDesk is a fictional SDK fixture for an OpenComputer Serverless Agents
example. This guide is the public onboarding document checked by that agent.
