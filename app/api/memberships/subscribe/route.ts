import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { createSubscription } from "@/app/lib/razorpay";
import { MEMBERSHIPS_TABLE } from "@/app/lib/creatorPayouts";

// Starts a real paid membership: creates a live Razorpay Subscription for
// the signed-in viewer against the fixed InPlayer membership Plan, and
// records a "created" row in InPlayer-Memberships so the UI has something
// to show immediately. This row is NOT yet an active membership — Razorpay
// hasn't actually charged anyone yet at this point, the viewer still has
// to complete the Checkout popup on the frontend. The webhook
// (app/api/webhooks/razorpay) is what flips this to "active" once a real
// payment actually lands; that's the only place money changes hands.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const planId = process.env.RAZORPAY_MEMBERSHIP_PLAN_ID;
  if (!planId) {
    return NextResponse.json(
      { error: "Memberships aren't configured yet — missing RAZORPAY_MEMBERSHIP_PLAN_ID." },
      { status: 503 }
    );
  }

  let creatorId: string;
  try {
    const body = await request.json();
    creatorId = typeof body?.creatorId === "string" ? body.creatorId.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!creatorId) {
    return NextResponse.json({ error: "creatorId is required." }, { status: 400 });
  }
  if (creatorId === user.userId) {
    return NextResponse.json(
      { error: "You can't become a paid member of your own channel." },
      { status: 400 }
    );
  }

  // Make sure this is a real account before creating a real, billable
  // subscription against it.
  try {
    const creatorResult = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId: creatorId },
        ProjectionExpression: "userId",
      })
    );
    if (!creatorResult.Item) {
      return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    }
  } catch (err) {
    console.error("memberships/subscribe: creator lookup failed:", err);
    return NextResponse.json({ error: "Couldn't start membership right now." }, { status: 500 });
  }

  // Already an active (or pending-first-charge) member? Don't create a
  // second Razorpay subscription for the same pair — hand back the
  // existing one so the frontend can resume it if it's still pending.
  try {
    const existing = await docClient.send(
      new GetCommand({
        TableName: MEMBERSHIPS_TABLE,
        Key: { subscriberId: user.userId, creatorId },
      })
    );
    if (existing.Item && (existing.Item.status === "active" || existing.Item.status === "created")) {
      return NextResponse.json({
        subscriptionId: existing.Item.razorpaySubscriptionId,
        status: existing.Item.status,
        alreadyExists: true,
      });
    }
  } catch (err) {
    console.error("memberships/subscribe: existing-membership lookup failed:", err);
    // Fail open here — worst case Razorpay itself is the backstop against
    // true duplicates (same customer/plan), and this is just a UX nicety.
  }

  let subscription;
  try {
    subscription = await createSubscription({
      planId,
      subscriberId: user.userId,
      creatorId,
    });
  } catch (err) {
    console.error("memberships/subscribe: Razorpay subscription creation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't start membership right now." },
      { status: 502 }
    );
  }

  try {
    await docClient.send(
      new PutCommand({
        TableName: MEMBERSHIPS_TABLE,
        Item: {
          subscriberId: user.userId,
          creatorId,
          razorpaySubscriptionId: subscription.id,
          status: "created",
          createdAt: new Date().toISOString(),
        },
      })
    );
  } catch (err) {
    // The Razorpay subscription now exists even if this write failed — log
    // loudly so it's investigable, but still hand the subscription back to
    // the frontend so Checkout can proceed. The webhook write (keyed by
    // subscription id via `notes`) will self-heal this row once a real
    // charge comes in.
    console.error("memberships/subscribe: failed to record membership row:", err);
  }

  return NextResponse.json({ subscriptionId: subscription.id, status: "created" });
}
