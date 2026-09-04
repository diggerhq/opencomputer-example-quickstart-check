const ORDERS = Object.freeze([
  Object.freeze({ id: "ord_1042", customer: "Ada Lovelace", totalCents: 4900, currency: "USD" }),
  Object.freeze({ id: "ord_1043", customer: "Grace Hopper", totalCents: 12500, currency: "USD" }),
  Object.freeze({ id: "ord_1044", customer: "Katherine Johnson", totalCents: 7800, currency: "USD" }),
  Object.freeze({ id: "ord_1045", customer: "Margaret Hamilton", totalCents: 3200, currency: "USD" }),
]);

/** A small, offline SDK fixture. No request leaves the process. */
export class ParcelDesk {
  constructor({ workspace = "demo" } = {}) {
    if (workspace !== "demo") {
      throw new Error('This SDK fixture includes only the "demo" workspace.');
    }

    this.orders = Object.freeze({
      /** Return one page of orders, with an opaque cursor for the next page. */
      async list({ limit = 2, cursor = null } = {}) {
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
          throw new RangeError("limit must be an integer between 1 and 100.");
        }

        let start = 0;
        if (cursor !== null) {
          const previous = ORDERS.findIndex((order) => cursor === `after:${order.id}`);
          if (previous === -1) {
            throw new Error("Invalid orders cursor. Pass nextCursor from the previous response.");
          }
          start = previous + 1;
        }

        const items = ORDERS.slice(start, start + limit).map((order) => ({ ...order }));
        const nextCursor = start + items.length < ORDERS.length
          ? `after:${items.at(-1).id}`
          : null;

        return { items, nextCursor };
      },
    });
  }
}
