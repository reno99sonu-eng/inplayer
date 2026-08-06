// Plain, import-free math/validation helpers for Hammart orders —
// deliberately has ZERO imports (same reasoning as app/lib/upi.ts) so
// client components (the product page, the cart page, the vendor sales
// dashboard) can compute an order's real total without pulling the AWS
// SDK / DynamoDB client into the browser bundle. app/lib/hammartOrders.ts
// re-exports these for server-side callers that already import from that
// file — same split as that file's own buildUpiLink re-export.
export const MAX_ORDER_QUANTITY = 20;

export function clampOrderQuantity(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_ORDER_QUANTITY);
}

// The real amount a buyer owes for one order line: unit price × quantity.
// Falls back to quantity 1 for order rows saved before quantity support
// existed — DynamoDB is schemaless, so those older rows simply don't have
// the attribute, and treating "missing" as "1" matches what actually
// happened at the time (every pre-cart order was exactly one unit).
export function orderTotalInr(order: { priceInr: number; quantity?: number }): number {
  return order.priceInr * clampOrderQuantity(order.quantity ?? 1);
}
