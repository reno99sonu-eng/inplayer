import { PutCommand, GetCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { clampOrderQuantity } from "@/app/lib/hammartOrderMath";

// Hammart orders. Since the Razorpay Route migration, a vendor's checkout
// uses ONE OF TWO payment methods (chosen per vendor, never required —
// see app/api/hammart/checkout/route.ts's header comment):
//
//   Razorpay Route — for a vendor whose linked account is "active". A
//   real Razorpay Order + Route transfer, and status only ever reaches
//   "paid" once app/api/webhooks/razorpay/route.ts's signature-verified
//   payment.captured handler says so — never from a client-side claim.
//   These rows go payment_pending -> paid/payment_failed.
//
//   Direct UPI — the fallback for a vendor who hasn't set up Razorpay
//   Route (or isn't active yet). The buyer pays the vendor's own UPI ID
//   directly; InPlayer never sees that money move. These rows are
//   created straight into "placed" — the ORIGINAL meaning that status
//   has always had ("buyer says they paid, InPlayer's server never saw
//   it") — and stay there until the vendor confirms they actually
//   received the payment. This is a live, ongoing payment path, not just
//   a historical status left over from before Route existed.
//
// "vendor_confirmed" means "the vendor says they're fulfilling it"
// either way — for a Razorpay-path order that's a fulfillment claim on
// top of already-verified payment; for a UPI-path order it's the
// vendor's word on BOTH the payment and the fulfillment, same trust
// model Hammart has always used for that path.
export const ORDERS_TABLE = "Hammart-Orders"; // PK: orderId

export type OrderStatus =
  | "placed" // direct-UPI path (live) — see header comment above
  | "payment_pending"
  | "paid"
  | "payment_failed"
  | "vendor_confirmed"
  | "vendor_cancelled";

export type OrderFeedbackType = "feedback" | "complaint";
export type OrderFeedbackStatus = "open" | "resolved";

// A lightweight, one-per-order "tell the vendor something" channel — not
// a full support-ticket thread. A buyer submits one note (general
// feedback or a complaint); the vendor can reply once, which marks it
// resolved. Stored directly on the order row (see submitOrderFeedback /
// respondToOrderFeedback below) — no separate table needed since it's
// always 1:1 with an order.
export interface OrderFeedback {
  type: OrderFeedbackType;
  message: string;
  createdAt: string;
  status: OrderFeedbackStatus;
  vendorResponse?: string | null;
  vendorRespondedAt?: string | null;
}

export interface HammartOrder {
  orderId: string;
  productId: string;
  productTitle: string;
  productImageUrl: string | null;
  priceInr: number;
  // Per-unit quantity — priceInr always stays the UNIT price (unchanged
  // meaning from before this field existed); see orderTotalInr in
  // app/lib/hammartOrderMath.ts for the real amount owed. Optional so
  // older rows saved before cart/quantity support existed (DynamoDB is
  // schemaless) are still valid — they're simply treated as quantity 1,
  // which is what they actually were.
  quantity?: number;
  buyerUserId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string | null;
  deliveryAddress?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  vendorUserId: string;
  vendorId: string;
  vendorUpiId: string;
  status: OrderStatus;
  // Real payment fields — only set for orders created via the Razorpay
  // Route checkout (app/api/hammart/checkout/route.ts). Multiple
  // HammartOrder rows from the same vendor in one checkout share one
  // razorpayOrderId/razorpayPaymentId (one Razorpay Order, one Route
  // transfer, covering that whole vendor group) — see that route's
  // comment for why they're grouped this way.
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  platformFeeInr?: number;
  vendorPayoutInr?: number;
  feedback?: OrderFeedback | null;
  createdAt: string;
  updatedAt: string;
}

export async function createOrder(
  input: Omit<HammartOrder, "orderId" | "status" | "createdAt" | "updatedAt"> & { status?: OrderStatus }
): Promise<{ success: boolean; order?: HammartOrder; tableMissing?: boolean }> {
  const now = new Date().toISOString();
  const order: HammartOrder = {
    ...input,
    quantity: clampOrderQuantity(input.quantity ?? 1),
    orderId: randomUUID(),
    // app/api/hammart/checkout/route.ts always passes status explicitly —
    // "payment_pending" for the Razorpay path (flipped to
    // "paid"/"payment_failed" only from the verified webhook), or
    // "placed" for the direct-UPI path. The "placed" default here is just
    // a safety net so nothing else in the codebase silently breaks if
    // some other caller creates a row without specifying a status.
    status: input.status ?? "placed",
    createdAt: now,
    updatedAt: now,
  };
  try {
    await docClient.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order }));
    return { success: true, order };
  } catch (err) {
    console.error("createOrder: write failed (table may not exist yet):", err);
    return { success: false, tableMissing: true };
  }
}

export async function getOrder(orderId: string): Promise<{ order: HammartOrder | null; tableMissing: boolean }> {
  try {
    const result = await docClient.send(new GetCommand({ TableName: ORDERS_TABLE, Key: { orderId } }));
    return { order: (result.Item as HammartOrder) || null, tableMissing: false };
  } catch (err) {
    console.error("getOrder: lookup failed (table may not exist yet):", err);
    return { order: null, tableMissing: true };
  }
}

async function scanAll(filterExpression: string, values: Record<string, unknown>): Promise<HammartOrder[]> {
  const items: HammartOrder[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: ORDERS_TABLE,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: values,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...((result.Items || []) as HammartOrder[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

export async function listBuyerOrders(buyerUserId: string): Promise<{ orders: HammartOrder[]; tableMissing: boolean }> {
  try {
    const orders = await scanAll("buyerUserId = :b", { ":b": buyerUserId });
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { orders, tableMissing: false };
  } catch (err) {
    console.error("listBuyerOrders: scan failed (table may not exist yet):", err);
    return { orders: [], tableMissing: true };
  }
}

export async function listVendorOrders(vendorUserId: string): Promise<{ orders: HammartOrder[]; tableMissing: boolean }> {
  try {
    const orders = await scanAll("vendorUserId = :v", { ":v": vendorUserId });
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { orders, tableMissing: false };
  } catch (err) {
    console.error("listVendorOrders: scan failed (table may not exist yet):", err);
    return { orders: [], tableMissing: true };
  }
}

export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: ORDERS_TABLE,
      Key: { orderId },
      UpdateExpression: "SET #status = :status, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status, ":now": new Date().toISOString() },
    })
  );
}

// Called ONLY from app/api/webhooks/razorpay/route.ts's signature-verified
// payment.captured handler — this is the single place a Hammart order is
// allowed to become "paid". Idempotent (Razorpay can and does redeliver
// the same webhook event) — writing the same status/payment id twice is a
// harmless no-op, so this doesn't need the ConditionExpression dance
// app/api/webhooks/razorpay/route.ts's creator-revenue-ledger path uses
// (that one guards an ADD that would double-credit a balance; this is
// just a status field). Always wins over a prior "payment_failed" — a
// captured event is authoritative proof money moved, even if an earlier
// attempt on the same order had failed first.
//
// platformFeeInr/vendorPayoutInr are NOT set here — they're already on
// the row from the moment app/api/hammart/checkout/route.ts created it
// (computed per order line, before payment even started), so there's no
// need to reconstruct or re-derive them from the webhook payload.
export async function markOrderPaid(
  orderId: string,
  payment: { razorpayOrderId: string; razorpayPaymentId: string }
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: ORDERS_TABLE,
      Key: { orderId },
      UpdateExpression: "SET #status = :status, razorpayOrderId = :roid, razorpayPaymentId = :rpid, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "paid",
        ":roid": payment.razorpayOrderId,
        ":rpid": payment.razorpayPaymentId,
        ":now": new Date().toISOString(),
      },
    })
  );
}

// Only downgrades an order that's still genuinely unpaid — see
// markOrderPaid's comment on why a captured event must always win instead
// of a possible out-of-order failed event undoing it.
export async function markOrderPaymentFailed(orderId: string, razorpayOrderId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: ORDERS_TABLE,
      Key: { orderId },
      UpdateExpression: "SET #status = :status, razorpayOrderId = :roid, updatedAt = :now",
      ConditionExpression: "#status = :pending",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "payment_failed",
        ":pending": "payment_pending",
        ":roid": razorpayOrderId,
        ":now": new Date().toISOString(),
      },
    })
  ).catch((err) => {
    const name = (err as { name?: string } | undefined)?.name;
    if (name === "ConditionalCheckFailedException") return; // already paid — leave it alone
    throw err;
  });
}

// Buyer leaves feedback or files a complaint on their own order — see
// OrderFeedback's comment above. A resubmit overwrites the previous note
// (this is a single-note channel, not a thread).
export async function submitOrderFeedback(
  orderId: string,
  feedback: { type: OrderFeedbackType; message: string }
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: ORDERS_TABLE,
      Key: { orderId },
      UpdateExpression: "SET feedback = :feedback, updatedAt = :now",
      ExpressionAttributeValues: {
        ":feedback": {
          type: feedback.type,
          message: feedback.message,
          createdAt: new Date().toISOString(),
          status: "open",
        },
        ":now": new Date().toISOString(),
      },
    })
  );
}

// Vendor replies to feedback/a complaint on one of their own orders,
// which also marks it resolved. Only ever called after submitOrderFeedback
// has already put a `feedback` map on the row (enforced by the caller —
// see app/api/hammart/orders/[orderId]/feedback/route.ts's PATCH handler)
// since SET on a nested path requires the parent map to already exist.
export async function respondToOrderFeedback(orderId: string, vendorResponse: string): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: ORDERS_TABLE,
      Key: { orderId },
      UpdateExpression:
        "SET feedback.vendorResponse = :resp, feedback.vendorRespondedAt = :now, feedback.#status = :resolved, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":resp": vendorResponse, ":now": now, ":resolved": "resolved" },
    })
  );
}

// Re-exported for any server-side caller that already imports from this
// file — the real implementations live in app/lib/upi.ts and
// app/lib/hammartOrderMath.ts (plain, import-free modules) so client
// components can use them too without pulling AWS SDK code into the
// browser bundle.
export { buildUpiLink } from "@/app/lib/upi";
export { clampOrderQuantity, MAX_ORDER_QUANTITY, orderTotalInr } from "@/app/lib/hammartOrderMath";
