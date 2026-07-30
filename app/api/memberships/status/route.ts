import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { MEMBERSHIPS_TABLE } from "@/app/lib/creatorPayouts";

// Tells the frontend whether the signed-in viewer already has a paid
// membership with a given creator, and what state it's in. "active" is the
// only state that should unlock any member-only perk — "created" means a
// Razorpay subscription exists but no payment has actually landed yet
// (Checkout was opened but not completed, or the webhook hasn't arrived
// yet), which must NOT be treated as a real membership.
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const creatorId = request.nextUrl.searchParams.get("creatorId");
  if (!creatorId) {
    return NextResponse.json({ error: "creatorId is required." }, { status: 400 });
  }

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: MEMBERSHIPS_TABLE,
        Key: { subscriberId: user.userId, creatorId },
      })
    );

    if (!result.Item) {
      return NextResponse.json({ status: "none", isActive: false });
    }

    const status = (result.Item.status as string) || "none";
    return NextResponse.json({
      status,
      isActive: status === "active",
      razorpaySubscriptionId: result.Item.razorpaySubscriptionId || null,
    });
  } catch (err) {
    console.error("memberships/status: lookup failed:", err);
    return NextResponse.json({ status: "none", isActive: false });
  }
}
