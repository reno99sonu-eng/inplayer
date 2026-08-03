import { PutCommand, GetCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";

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

export interface HammartOrder {
  orderId: string;
  productId: string;
  productTitle: string;
  productImageUrl: string | null;
  priceInr: number;
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
  createdAt: string;
  updatedAt: string;
}

export async function createOrder(
  input: Omit<HammartOrder, "orderId" | "status" | "createdAt" | "updatedAt">
): Promise<{ success: boolean; order?: HammartOrder; tableMissing?: boolean }> {
  const now = new Date().toISOString();
  const order: HammartOrder = { ...input, orderId: randomUUID(), status: "placed", createdAt: now, updatedAt: now };
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

// Re-exported for any server-side caller that already imports from this
// file — the real implementation lives in app/lib/upi.ts (a plain,
// import-free module) so client components can use it too without
// pulling AWS SDK code into the browser bundle.
export { buildUpiLink } from "@/app/lib/upi";
