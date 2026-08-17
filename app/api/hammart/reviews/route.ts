import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { createReview } from "@/app/lib/hammartReviews";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body.productId || typeof body.rating !== "number") {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const result = await createReview({
    productId: body.productId,
    userId: user.userId,
    userName: user.name,
    userAvatar: user.profilePictureUrl || undefined,
    rating: body.rating,
    comment: body.comment || "",
  });

  if (!result.success) {
    if (result.tableMissing) {
      return NextResponse.json({ error: "Reviews table missing." }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to save review." }, { status: 500 });
  }

  return NextResponse.json({ success: true, review: result.review });
}
