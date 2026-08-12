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
import { VENDORS_TABLE, VENDOR_SUBSCRIPTION_LEDGER_TABLE, setVendorRazorpayAccount } from "@/app/lib/hammartVendors";
import { getOrder, markOrderPaid, markOrderPaymentFailed } from "@/app/lib/hammartOrders";
import { orderTotalInr } from "@/app/lib/hammartOrderMath";
import { sendEmail } from "@/app/lib/ses";

// This is the ONLY place real money ever gets credited to a creator's
// balance in InPlayer, and (as of the Route migration) the ONLY place a
// Hammart order is ever allowed to become "paid". Everything else in the
// app (Checkout's browser callback, the membership status endpoint, the
// UI) only ever reflects what this handler has already written — a
// client can't unlock a paid membership, credit a creator, or mark a
// Hammart order paid just by calling another route.
//
// Configure this in Razorpay Dashboard -> Settings -> Webhooks:
//   URL: https://inplayer.in/api/webhooks/razorpay
//   Events: subscription.charged, subscription.cancelled, subscription.halted,
//           payment.captured, payment.failed,
//           account.activated, account.suspended, account.under_review
//   Secret: whatever you generate there -> save as RAZORPAY_WEBHOOK_SECRET

interface RazorpayPaymentEntity {
  id: string;
  order_id?: string;
  amount: number; // paise
  status: string;
  notes?: Record<string, string>;
}

interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  notes?: { subscriberId?: string; creatorId?: string; vendorId?: string };
}

interface RazorpayAccountEntity {
  id: string;
  status: string; // "activated" | "suspended" | "under_review" | ...
  reference_id?: string; // InPlayer's userId — see createLinkedAccount's comment
}

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    subscription?: { entity: RazorpaySubscriptionEntity };
    account?: { entity: RazorpayAccountEntity };
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
      case "payment.captured":
        await handleHammartPaymentCaptured(event.payload);
        break;
      case "payment.failed":
        await handleHammartPaymentFailed(event.payload);
        break;
      case "account.activated":
      case "account.suspended":
      case "account.under_review":
        await handleAccountStatusChanged(event.payload);
        break;
      default:
        // Every other event (subscription.activated, subscription.authenticated,
        // etc.) is intentionally a no-op: subscription.charged is the only
        // event that carries proof a real subscription payment landed, so
        // it's the only one allowed to activate a membership or credit a
        // creator. Hammart order payments and Route account status have
        // their own explicit events handled above instead.
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

  // Hammart vendor platform-fee subscriptions carry a `vendorId` note
  // instead of `subscriberId`/`creatorId` (see createVendorSubscription in
  // app/lib/razorpay.ts) — branch here rather than conflating them with
  // creator-membership charges below, which credit a completely different
  // table.
  if (subEntity.notes?.vendorId) {
    await handleVendorCharged(paymentEntity, subEntity, subEntity.notes.vendorId);
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

async function handleVendorCharged(
  paymentEntity: RazorpayPaymentEntity,
  subEntity: RazorpaySubscriptionEntity,
  vendorId: string
) {
  const amountInr = paymentEntity.amount / 100;

  // Same idempotency gate as the creator-membership path — keyed on
  // Razorpay's own payment id, never processed twice.
  try {
    await docClient.send(
      new PutCommand({
        TableName: VENDOR_SUBSCRIPTION_LEDGER_TABLE,
        Item: {
          razorpayPaymentId: paymentEntity.id,
          razorpaySubscriptionId: subEntity.id,
          vendorId,
          amountInr,
          recordedAt: new Date().toISOString(),
        },
        ConditionExpression: "attribute_not_exists(razorpayPaymentId)",
      })
    );
  } catch (err) {
    const name = (err as { name?: string } | undefined)?.name;
    if (name === "ConditionalCheckFailedException") return;
    throw err;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: VENDORS_TABLE,
      Key: { userId: vendorId },
      UpdateExpression:
        "SET subscriptionStatus = :active, razorpaySubscriptionId = :subId, lastChargedAt = :now, updatedAt = :now",
      ExpressionAttributeValues: {
        ":active": "active",
        ":subId": subEntity.id,
        ":now": new Date().toISOString(),
      },
    })
  );
}

async function handleVendorDeactivated(vendorId: string, status: "cancelled" | "halted") {
  console.log(`razorpay webhook: vendor ${vendorId} subscription ${status}`);
  await docClient.send(
    new UpdateCommand({
      TableName: VENDORS_TABLE,
      Key: { userId: vendorId },
      UpdateExpression: "SET subscriptionStatus = :status, updatedAt = :now",
      ExpressionAttributeValues: { ":status": "expired", ":now": new Date().toISOString() },
    })
  );
}

async function handleDeactivated(
  payload: RazorpayWebhookPayload["payload"],
  status: "cancelled" | "halted"
) {
  const subEntity = payload.subscription?.entity;
  if (!subEntity) return;

  if (subEntity.notes?.vendorId) {
    await handleVendorDeactivated(subEntity.notes.vendorId, status);
    return;
  }

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

// Hammart checkout (app/api/hammart/checkout/route.ts) stamps every
// Razorpay Order's notes with hammartOrderIds (comma-joined HammartOrder
// ids covering that one vendor-group payment) and hammartVendorId.
// Subscription payments (memberships, vendor listing fees) also fire
// payment.captured, but never carry this note — so this is a safe no-op
// for every event that isn't actually a Hammart order.
function parseHammartNotes(notes: Record<string, string> | undefined): { orderIds: string[]; vendorId: string } | null {
  const orderIdsRaw = notes?.hammartOrderIds;
  const vendorId = notes?.hammartVendorId;
  if (!orderIdsRaw || !vendorId) return null;
  const orderIds = orderIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (orderIds.length === 0) return null;
  return { orderIds, vendorId };
}

async function handleHammartPaymentCaptured(payload: RazorpayWebhookPayload["payload"]) {
  const paymentEntity = payload.payment?.entity;
  if (!paymentEntity || paymentEntity.status !== "captured" || !paymentEntity.order_id) return;

  const parsed = parseHammartNotes(paymentEntity.notes);
  if (!parsed) return; // not a Hammart order payment — e.g. a subscription charge

  await Promise.all(
    parsed.orderIds.map(async (orderId) => {
      try {
        await markOrderPaid(orderId, {
          razorpayOrderId: paymentEntity.order_id as string,
          razorpayPaymentId: paymentEntity.id,
        });
      } catch (err) {
        console.error(`razorpay webhook: markOrderPaid failed for ${orderId}:`, err);
        return;
      }

      // Buyer confirmation email — deliberately sent from HERE, not from
      // app/api/hammart/checkout/route.ts, so a buyer only ever gets
      // "your order is confirmed" once a real, signature-verified payment
      // actually landed, never for a Checkout popup they closed without
      // paying.
      try {
        const { order } = await getOrder(orderId);
        if (order?.buyerEmail) {
          const total = orderTotalInr(order);
          void sendEmail({
            to: order.buyerEmail,
            subject: `Payment confirmed — Hammart order [${orderId.slice(0, 8).toUpperCase()}]`,
            text: `Your payment of ₹${total.toLocaleString("en-IN")} for "${order.productTitle}" from @${order.vendorId} is confirmed. The vendor has been notified and will ship to the address you provided.`,
            html: `<h2>Payment confirmed</h2><p>Your payment of <strong>₹${total.toLocaleString("en-IN")}</strong> for <strong>${order.productTitle}</strong> from <strong>@${order.vendorId}</strong> is confirmed.</p><p>The vendor has been notified and will ship to the address you provided.</p>`,
          }).catch((err) => console.error(`razorpay webhook: buyer confirmation email failed for ${orderId}:`, err));
        }
      } catch (err) {
        console.error(`razorpay webhook: couldn't load order ${orderId} for confirmation email:`, err);
      }
    })
  );
}

async function handleHammartPaymentFailed(payload: RazorpayWebhookPayload["payload"]) {
  const paymentEntity = payload.payment?.entity;
  if (!paymentEntity || !paymentEntity.order_id) return;

  const parsed = parseHammartNotes(paymentEntity.notes);
  if (!parsed) return;

  await Promise.all(
    parsed.orderIds.map((orderId) =>
      markOrderPaymentFailed(orderId, paymentEntity.order_id as string).catch((err) =>
        console.error(`razorpay webhook: markOrderPaymentFailed failed for ${orderId}:`, err)
      )
    )
  );
}

// Route linked-account status changed on Razorpay's side — this is the
// primary way a vendor's razorpayAccountStatus ever reaches "active"
// (app/api/admin/hammart-vendors/route.ts's "sync_razorpay" admin action
// is the manual fallback for whenever this event is missed). reference_id
// is InPlayer's own userId (see createLinkedAccount's comment), so this
// maps straight back to a VENDORS_TABLE row with no lookup table needed.
async function handleAccountStatusChanged(payload: RazorpayWebhookPayload["payload"]) {
  const accountEntity = payload.account?.entity;
  const userId = accountEntity?.reference_id;
  if (!accountEntity || !userId) return;

  const status =
    accountEntity.status === "activated" ? "active" : accountEntity.status === "suspended" ? "failed" : "pending";

  await setVendorRazorpayAccount(userId, {
    accountId: accountEntity.id,
    status,
    error: status === "active" ? null : `Razorpay status: ${accountEntity.status}`,
  }).catch((err) => console.error(`razorpay webhook: account status update failed for ${userId}:`, err));
}
