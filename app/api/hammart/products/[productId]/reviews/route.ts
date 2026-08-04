import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { createReview, listProductReviews } from "@/app/lib/hammartReviews";

interface Params {
  params: Promise<{ productId: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { productId } = await params;
  const { reviews, averageRating, totalReviews, tableMissing } = await listProductReviews(productId);
  return NextResponse.json({ reviews, averageRating, totalReviews, tableMissing });
}

export async function POST(request: NextRequest, { params }: Params) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in to leave a review." }, { status: 401 });
  }

  const { productId } = await params;
  const body = await request.json().catch(() => ({}));
  const rating = Number(body.rating);
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : "";

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Please provide a rating between 1 and 5 stars." }, { status: 400 });
  }
  if (!comment) {
    return NextResponse.json({ error: "Please write a brief feedback comment." }, { status: 400 });
  }

  const result = await createReview({
    productId,
    userId: user.userId,
    userName: user.name || "Verified Customer",
    rating,
    comment,
  });

  if (!result.success) {
    return NextResponse.json({ error: "Unable to save review — please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true, review: result.review });
}
