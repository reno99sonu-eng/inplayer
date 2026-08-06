import { PutCommand, GetCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { clampOrderQuantity } from "@/app/lib/hammartOrderMath";

// Hammart orders. IMPORTANT — read before assuming this table means "a
// payment happened": money for a Hammart order moves buyer -> vendor
// DIRECTLY over UPI (buyer scans the vendor's own UPI QR/pays their VPA),
// never through InPlayer/Razorpay. That means InPlayer's server has NO
// way to confirm a payment actually landed — there's no gateway webhook
// for peer-to-peer UPI transfers. This table is therefore a claim/record
// system, not a payment ledger: "orderPlaced" means the buyer says they
// paid and clicked through, "vendorConfirmed" means the vendor says they
// received it and is fulfilling. Both sides can see the other's status,
// same as any other marketplace with off-platform payment, but neither
// status is cryptographic proof of money movement. This is communicated
// to both buyer and vendor in the UI, not hidden.
export const ORDERS_TABLE = "Hammart-Orders"; // PK: orderId

export type OrderStatus = "placed" | "vendor_confirmed" | "vendor_cancelled";

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
  feedback?: OrderFeedback | null;
  createdAt: string;
  updatedAt: string;
}

export async function createOrder(
  input: Omit<HammartOrder, "orderId" | "status" | "createdAt" | "updatedAt">
): Promise<{ success: boolean; order?: HammartOrder; tableMissing?: boolean }> {
  const now = new Date().toISOString();
  const order: HammartOrder = {
    ...input,
    quantity: clampOrderQuantity(input.quantity ?? 1),
    orderId: randomUUID(),
    status: "placed",
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
