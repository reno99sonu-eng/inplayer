import { PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";

export const REVIEWS_TABLE = "Hammart-Reviews"; // PK: reviewId, GSI: productId

export interface HammartReview {
  reviewId: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
}

export interface CreateReviewInput {
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
}

export async function createReview(
  input: CreateReviewInput
): Promise<{ success: boolean; review?: HammartReview; tableMissing?: boolean }> {
  const now = new Date().toISOString();
  const review: HammartReview = {
    reviewId: randomUUID(),
    productId: input.productId,
    userId: input.userId,
    userName: input.userName,
    userAvatar: input.userAvatar,
    rating: Math.min(5, Math.max(1, input.rating)),
    comment: input.comment,
    createdAt: now,
  };

  try {
    await docClient.send(new PutCommand({ TableName: REVIEWS_TABLE, Item: review }));
    return { success: true, review };
  } catch (err) {
    console.error("createReview failed (table may not exist yet):", err);
    return { success: false, tableMissing: true };
  }
}

export async function listProductReviews(
  productId: string
): Promise<{ reviews: HammartReview[]; averageRating: number; totalReviews: number; tableMissing: boolean }> {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: REVIEWS_TABLE,
        FilterExpression: "productId = :pid",
        ExpressionAttributeValues: { ":pid": productId },
      })
    );

    const reviews = (result.Items as HammartReview[]) || [];
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalReviews = reviews.length;
    // 0, not 5.0, when there are no real reviews yet — a brand-new product
    // with zero ratings should never render as if it already has a
    // real 5-star track record. The product page treats 0 as "not yet
    // rated" and shows an honest "No ratings yet" state instead of stars.
    const averageRating =
      totalReviews > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
        : 0;

    return { reviews, averageRating, totalReviews, tableMissing: false };
  } catch (err) {
    console.error("listProductReviews failed (table may not exist yet):", err);
    return { reviews: [], averageRating: 0, totalReviews: 0, tableMissing: true };
  }
}
