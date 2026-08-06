import { PutCommand, GetCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { clampOrderQuantity } from "@/app/lib/hammartOrderMath";

// Hammart's per-user shopping cart. Same manual-table-creation /
// tableMissing convention as every other Hammart table (see
// app/lib/hammartVendors.ts's top comment) — Reno creates this by hand in
// the AWS DynamoDB console.
//
// Deliberately stores ONLY {userId, productId, quantity, addedAt} — never
// a denormalized snapshot of price/title/image — because a cart showing
// a stale price is worse than no cart at all. Every read (see
// /api/hammart/cart's GET) re-joins each row against the live product
// record, so what a customer sees in their cart is always the vendor's
// current real price and availability, matching exactly what checkout
// will actually charge.
export const CART_TABLE = "Hammart-Cart-Items"; // PK: userId, SK: productId

export interface CartItemRow {
  userId: string;
  productId: string;
  quantity: number;
  addedAt: string;
}

export async function listCartItems(userId: string): Promise<{ items: CartItemRow[]; tableMissing: boolean }> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: CART_TABLE,
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: { ":u": userId },
      })
    );
    return { items: (result.Items || []) as CartItemRow[], tableMissing: false };
  } catch (err) {
    console.error("listCartItems: query failed (table may not exist yet):", err);
    return { items: [], tableMissing: true };
  }
}

// "Add to Cart" — increments whatever quantity is already in the cart for
// this product (clicking Add to Cart on a 2nd visit adds more, it doesn't
// reset the count).
export async function addToCart(userId: string, productId: string, quantityToAdd: number): Promise<{ quantity: number }> {
  const existing = await docClient.send(new GetCommand({ TableName: CART_TABLE, Key: { userId, productId } }));
  const currentQty = typeof existing.Item?.quantity === "number" ? existing.Item.quantity : 0;
  const nextQty = clampOrderQuantity(currentQty + quantityToAdd);
  await docClient.send(
    new PutCommand({
      TableName: CART_TABLE,
      Item: { userId, productId, quantity: nextQty, addedAt: new Date().toISOString() },
    })
  );
  return { quantity: nextQty };
}

// Used by the cart page's own quantity +/- stepper — sets the absolute
// quantity rather than adding to it.
export async function setCartItemQuantity(userId: string, productId: string, quantity: number): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: CART_TABLE,
      Item: { userId, productId, quantity: clampOrderQuantity(quantity), addedAt: new Date().toISOString() },
    })
  );
}

export async function removeCartItem(userId: string, productId: string): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: CART_TABLE, Key: { userId, productId } }));
}
