import { NextRequest, NextResponse } from "next/server";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyWebhookSignature } from "@/app/lib/razorpay";
import {
  REVENUE_LEDGER_TABLE,
  MEMBERSHIPS_TABLE,
  PAYOUTS_TABLE,
  CREATOR_SHARE,
} from "@/app/lib/creatorPayouts";

// This is the ONLY place real money ever gets credited to a creator's
// balance in InPlayer. Everything else in the app (Checkout's browser
// callback, the membership status endpoint, the UI) only ever reflects
// what this handler has already written — a client can't unlock a paid
// membership or credit a creator just by calling another route, because no
// other route touches InPlayer-Revenue-Ledger or
// InPlayer-Creator-Payouts.lifetimeEarnedInr.
//
// Configure this in Razorpay Dashboard -> Settings -> Webhooks:
//   URL: https://inplayer.in/api/webhooks/razorpay
//   Events: subscription.charged, subscription.cancelled, subscription.halted
//   Secret: whatever you generate there -> save as RAZORPAY_WEBHOOK_SECRET

interface RazorpayPaymentEntity {
  id: string;
  amount: number; // paise
  status: string;
}

interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  notes?: { subscriberId?: string; creatorId?: string };
}

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    subscription?: { entity: RazorpaySubscriptionEntity };
  };
}

export async function POST(request: NextRequest) {
  // MUST read the raw text before any JSON parsing — the signature is
  // computed over the exact bytes Razorpay sent, not a re-serialized copy.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("razorpay webhook: signature verification failed");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: RazorpayWebhookPayload;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    switch (event.event) {
      case "subscription.charged":
        await handleCharged(event.payload);
        break;
      case "subscription.cancelled":
      case "subscription.halted":
        await handleDeactivated(event.payload, event.event === "subscription.cancelled" ? "cancelled" : "halted");
        break;
      default:
        // Every other event (subscription.activated, subscription.authenticated,
        // payment.failed, etc.) is intentionally a no-op: subscription.charged
        // is the only event that carries proof a real payment landed, so it's
        // the only one allowed to activate a membership or credit a creator.
        break;
    }
  } catch (err) {
    console.error(`razorpay webhook: failed handling ${event.event}:`, err);
    // Still 200 — a bug on our end shouldn't make Razorpay hammer this
    // endpoint with retries indefinitely for the same event. Errors are
    // logged for manual investigation instead.
  }

  return NextResponse.json({ received: true });
}

async function handleCharged(payload: RazorpayWebhookPayload["payload"]) {
  const paymentEntity = payload.payment?.entity;
  const subEntity = payload.subscription?.entity;
  if (!paymentEntity || !subEntity) {
    console.error("razorpay webhook: subscription.charged missing payment/subscription entity");
    return;
  }
  if (paymentEntity.status !== "captured") {
    // Shouldn't happen for this event, but never credit anything for a
    // payment that isn't actually captured.
    return;
  }

  const subscriberId = subEntity.notes?.subscriberId;
  const creatorId = subEntity.notes?.creatorId;
  if (!subscriberId || !creatorId) {
    console.error(
      `razorpay webhook: subscription ${subEntity.id} charged with no subscriberId/creatorId in notes`
    );
    return;
  }

  const amountInr = paymentEntity.amount / 100;
  const creatorShareInr = Math.round(amountInr * CREATOR_SHARE * 100) / 100;

  // Idempotency gate: Razorpay retries webhook delivery on anything but a
  // 2xx response, and can also just legitimately send the same event more
  // than once. Keying this ledger row on Razorpay's own payment id and
  // conditioning the write on it not existing yet means a duplicate
  // delivery is a safe no-op instead of double-crediting the creator.
  try {
    await docClient.send(
      new PutCommand({
        TableName: REVENUE_LEDGER_TABLE,
        Item: {
          razorpayPaymentId: paymentEntity.id,
          razorpaySubscriptionId: subEntity.id,
          subscriberId,
          creatorId,
          amountInr,
          creatorShareInr,
          recordedAt: new Date().toISOString(),
        },
        ConditionExpression: "attribute_not_exists(razorpayPaymentId)",
      })
    );
  } catch (err) {
    const name = (err as { name?: string } | undefined)?.name;
    if (name === "ConditionalCheckFailedException") {
      // Already recorded this exact payment — do not credit again.
      return;
    }
    throw err;
  }

  // Only reached once, for a payment that was just recorded for the first
  // time — credit the creator's real, running lifetime balance.
  await docClient.send(
    new UpdateCommand({
      TableName: PAYOUTS_TABLE,
      Key: { userId: creatorId },
      UpdateExpression: "ADD lifetimeEarnedInr :share SET lastChargeAt = :now",
      ExpressionAttributeValues: { ":share": creatorShareInr, ":now": new Date().toISOString() },
    })
  );

  await docClient.send(
    new UpdateCommand({
      TableName: MEMBERSHIPS_TABLE,
      Key: { subscriberId, creatorId },
      UpdateExpression:
        "SET #status = :active, razorpaySubscriptionId = :subId, lastChargedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":active": "active",
        ":subId": subEntity.id,
        ":now": new Date().toISOString(),
      },
    })
  );
}

async function handleDeactivated(
  payload: RazorpayWebhookPayload["payload"],
  status: "cancelled" | "halted"
) {
  const subEntity = payload.subscription?.entity;
  if (!subEntity) return;

  const subscriberId = subEntity.notes?.subscriberId;
  const creatorId = subEntity.notes?.creatorId;
  if (!subscriberId || !creatorId) {
    console.error(`razorpay webhook: ${status} subscription ${subEntity.id} missing notes`);
    return;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: MEMBERSHIPS_TABLE,
      Key: { subscriberId, creatorId },
      UpdateExpression: "SET #status = :status, deactivatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status, ":now": new Date().toISOString() },
    })
  );
}
