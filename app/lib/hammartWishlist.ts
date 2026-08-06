import { PutCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

// Saved-for-later Hammart products. Same shape and same "no denormalized
// price" rule as the cart (see hammartCart.ts's top comment) — every read
// re-joins against the live product so a saved item never shows a stale
// price or a listing that's since been removed. Mirrors the existing
// InPlayer-Watchlist table/route pattern (app/api/watchlist/route.ts)
// almost exactly, just for Hammart products instead of videos.
export const WISHLIST_TABLE = "Hammart-Wishlist"; // PK: userId, SK: productId

export interface WishlistItemRow {
  userId: string;
  productId: string;
  addedAt: string;
}

export async function listWishlistItems(userId: string): Promise<{ items: WishlistItemRow[]; tableMissing: boolean }> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: WISHLIST_TABLE,
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: { ":u": userId },
      })
    );
    return { items: (result.Items || []) as WishlistItemRow[], tableMissing: false };
  } catch (err) {
    console.error("listWishlistItems: query failed (table may not exist yet):", err);
    return { items: [], tableMissing: true };
  }
}

export async function addToWishlist(userId: string, productId: string): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: WISHLIST_TABLE,
      Item: { userId, productId, addedAt: new Date().toISOString() },
    })
  );
}

export async function removeFromWishlist(userId: string, productId: string): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: WISHLIST_TABLE, Key: { userId, productId } }));
}
