export interface Order {
  id: string;
  customer: string;
  totalCents: number;
  currency: "USD";
}

export interface OrderPage {
  items: Order[];
  nextCursor: string | null;
}

export interface ListOrdersOptions {
  limit?: number;
  cursor?: string | null;
}

/** An offline fixture containing a single demo workspace. */
export class ParcelDesk {
  constructor(options?: { workspace?: "demo" });
  readonly orders: {
    list(options?: ListOrdersOptions): Promise<OrderPage>;
  };
}
