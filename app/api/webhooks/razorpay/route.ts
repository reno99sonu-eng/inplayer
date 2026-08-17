import { NextRequest, NextResponse } from "next/server";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyWebhookSignature } from "@/app/lib/razorpay";
import {
  REVENUE_LEDGER_TABLE,
  MEMBERSHIPS_TABLE,
  PAYOUTS_TABLE,
} from "@/app/lib/creatorPayouts";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import {
  VENDORS_TABLE,
  VENDOR_SUBSCRIPTION_LEDGER_TABLE,
  getVendorProfile,
  setVendorRazorpayAccount,
  notifyVendorPayoutsActive,
} from "@/app/lib/hammartVendors";
import { getOrder, markOrderPaid, markOrderPaymentFailed } from "@/app/lib/hammartOrders";
import { orderTotalInr } from "@/app/lib/hammartOrderMath";
import { sendEmail } from "@/app/lib/ses";
import { getSponsorship, markSponsorshipPaid, markSponsorshipPaymentFailed } from "@/app/lib/sponsorships";
import { sendOrderConfirmationMessage, sendVendorOrderMessage } from "@/app/lib/whatsapp";

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
        await handleSponsorshipPaymentCaptured(event.payload);
        break;
      case "payment.failed":
        await handleHammartPaymentFailed(event.payload);
        await handleSponsorshipPaymentFailed(event.payload);
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

  // 1. Fetch live settings for the dynamic split
  const settings = await getPlatformSettings();
  const creatorShareRatio = typeof settings.monetizationCreatorShare === "number" ? settings.monetizationCreatorShare : 0.8;

  // 2. Enforce Phase 5 monetization status
  let isMonetized = false;
  try {
    const creatorUser = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId: creatorId },
        ProjectionExpression: "monetizationStatus"
      })
    );
    isMonetized = creatorUser.Item?.monetizationStatus === "MONETIZED";
  } catch (err) {
    console.error(`Failed to verify monetization status for creator ${creatorId}`, err);
  }

  // Only calculate a non-zero share if they are explicitly monetized and global monetization is on
  const canEarn = isMonetized && settings.monetizationEnabled !== false;
  const creatorShareInr = canEarn ? Math.round(amountInr * creatorShareRatio * 100) / 100 : 0;

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

  // Only reached once, for a payment that was just recorded for the first time.
  // If they are monetized, credit the running balances and write to the earnings ledger.
  if (canEarn && creatorShareInr > 0) {
    const now = new Date().toISOString();
    
    // Credit running lifetime balance
    await docClient.send(
      new UpdateCommand({
        TableName: PAYOUTS_TABLE,
        Key: { userId: creatorId },
        UpdateExpression: "ADD lifetimeEarnedInr :share SET lastChargeAt = :now",
        ExpressionAttributeValues: { ":share": creatorShareInr, ":now": now },
      })
    );

    // Record the specific transaction in the new Creator Earnings table
    await docClient.send(
      new PutCommand({
        TableName: "InPlayer-Creator-Earnings",
        Item: {
          earningId: randomUUID(),
          creatorId: creatorId,
          source: "MEMBERSHIP",
          amountInr: creatorShareInr,
          grossAmountInr: amountInr,
          status: "PENDING",
          createdAt: now,
          razorpayPaymentId: paymentEntity.id,
          razorpaySubscriptionId: subEntity.id,
        }
      })
    );
  }

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
        if (order) {
          if (order.buyerEmail) {
            const total = orderTotalInr(order);
            void sendEmail({
              to: order.buyerEmail,
              subject: `Payment confirmed — Hammart order [${orderId.slice(0, 8).toUpperCase()}]`,
              text: `Your payment of ₹${total.toLocaleString("en-IN")} for "${order.productTitle}" from @${order.vendorId} is confirmed. The vendor has been notified and will ship to the address you provided.`,
              html: `<h2>Payment confirmed</h2><p>Your payment of <strong>₹${total.toLocaleString("en-IN")}</strong> for <strong>${order.productTitle}</strong> from <strong>@${order.vendorId}</strong> is confirmed.</p><p>The vendor has been notified and will ship to the address you provided.</p>`,
            }).catch((err) => console.error(`razorpay webhook: buyer confirmation email failed for ${orderId}:`, err));
          }
          
          if (order.buyerPhone && order.buyerName) {
             const total = orderTotalInr(order);
             void sendOrderConfirmationMessage(
               order.buyerPhone,
               order.buyerName,
               `₹${total.toLocaleString("en-IN")}`
             ).catch((err) => console.error(`razorpay webhook: WhatsApp confirmation failed for ${orderId}:`, err));
          }

          const { vendor } = await getVendorProfile(order.vendorUserId);
          if (vendor?.whatsappNumber) {
            const total = orderTotalInr(order);
            void sendVendorOrderMessage(
              vendor.whatsappNumber,
              vendor.vendorId,
              `Order ${orderId.slice(0, 8).toUpperCase()}: ${order.productTitle} (₹${total.toLocaleString("en-IN")})`
            ).catch((err) => console.error(`razorpay webhook: WhatsApp vendor notification failed for ${orderId}:`, err));
          }
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

// Ad-sponsorship checkout (app/api/sponsorships/checkout/route.ts) stamps
// every Razorpay Order's notes with { type: "sponsorship", sponsorshipId }
// — a plain one-time Order, never carrying hammartOrderIds, so this is a
// safe no-op for every payment.captured/failed event that isn't actually a
// sponsorship purchase (Hammart orders, memberships, vendor subscriptions
// all fall through parseSponsorshipNotes returning null).
function parseSponsorshipNotes(notes: Record<string, string> | undefined): string | null {
  if (notes?.type !== "sponsorship" || !notes?.sponsorshipId) return null;
  return notes.sponsorshipId;
}

async function handleSponsorshipPaymentCaptured(payload: RazorpayWebhookPayload["payload"]) {
  const paymentEntity = payload.payment?.entity;
  if (!paymentEntity || paymentEntity.status !== "captured" || !paymentEntity.order_id) return;

  const sponsorshipId = parseSponsorshipNotes(paymentEntity.notes);
  if (!sponsorshipId) return;

  try {
    await markSponsorshipPaid(sponsorshipId, paymentEntity.id);
  } catch (err) {
    console.error(`razorpay webhook: markSponsorshipPaid failed for ${sponsorshipId}:`, err);
    return;
  }

  // Two emails on a genuine, webhook-confirmed payment: the sponsor is
  // told exactly what to do next (email their assets in), and InPlayer's
  // own admin inbox — the SAME inplayerdigital@gmail.com address the
  // assets themselves get emailed to — gets a heads-up so a paid order
  // doesn't just sit unnoticed in Admin -> Sponsorships waiting to be
  // activated.
  try {
    const sponsorship = await getSponsorship(sponsorshipId);
    if (!sponsorship) return;

    const sectionLabels = sponsorship.sections
      .map((s) => (s === "midroll" ? "Mid-Roll Video Ad" : s === "homepage_banner" ? "Homepage Banner" : "Watch Page Banner"))
      .join(", ");

    void sendEmail({
      to: sponsorship.contactEmail,
      subject: "Payment confirmed — send your ad assets to activate your InPlayer sponsorship",
      text: `Your payment of ₹${sponsorship.amountInr.toLocaleString("en-IN")} for ${sectionLabels} is confirmed (reference ${sponsorshipId}). To go live, email your ad assets and website URL to inplayerdigital@gmail.com, mentioning reference ${sponsorshipId}. Your 7-day run starts the moment InPlayer activates your ad.`,
      html: `<h2>Payment confirmed</h2><p>Your payment of <strong>₹${sponsorship.amountInr.toLocaleString("en-IN")}</strong> for <strong>${sectionLabels}</strong> is confirmed.</p><p>Reference: <strong>${sponsorshipId}</strong></p><p>To go live, email your ad assets (and your website URL, if it's changed) to <strong>inplayerdigital@gmail.com</strong>, mentioning your reference above. Your 7-day run starts the moment InPlayer activates your ad.</p>`,
    }).catch((err) => console.error(`razorpay webhook: sponsor confirmation email failed for ${sponsorshipId}:`, err));

    if (sponsorship.contactPhone && sponsorship.contactName) {
       void sendOrderConfirmationMessage(
         sponsorship.contactPhone,
         sponsorship.contactName,
         `₹${sponsorship.amountInr.toLocaleString("en-IN")}`
       ).catch((err) => console.error(`razorpay webhook: WhatsApp confirmation failed for sponsor ${sponsorshipId}:`, err));
    }

    void sendEmail({
      to: "inplayerdigital@gmail.com",
      subject: `New paid sponsorship awaiting assets — ${sponsorship.companyName}`,
      text: `${sponsorship.companyName} (${sponsorship.contactEmail}) just paid ₹${sponsorship.amountInr.toLocaleString("en-IN")} for ${sectionLabels}. Reference ${sponsorshipId}. Once their assets arrive by email, activate this in Admin -> Sponsorships.`,
      html: `<p><strong>${sponsorship.companyName}</strong> (${sponsorship.contactEmail}) just paid <strong>₹${sponsorship.amountInr.toLocaleString("en-IN")}</strong> for <strong>${sectionLabels}</strong>.</p><p>Reference: ${sponsorshipId}</p><p>Once their assets arrive by email, activate this in Admin → Sponsorships.</p>`,
    }).catch((err) => console.error(`razorpay webhook: admin notify email failed for ${sponsorshipId}:`, err));
  } catch (err) {
    console.error(`razorpay webhook: couldn't load sponsorship ${sponsorshipId} for notification emails:`, err);
  }
}

async function handleSponsorshipPaymentFailed(payload: RazorpayWebhookPayload["payload"]) {
  const paymentEntity = payload.payment?.entity;
  if (!paymentEntity) return;

  const sponsorshipId = parseSponsorshipNotes(paymentEntity.notes);
  if (!sponsorshipId) return;

  await markSponsorshipPaymentFailed(sponsorshipId).catch((err) =>
    console.error(`razorpay webhook: markSponsorshipPaymentFailed failed for ${sponsorshipId}:`, err)
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

  // Read the vendor's status BEFORE overwriting it, purely so the "you're
  // live" email below can tell a genuine pending/failed -> active
  // transition apart from Razorpay re-sending the same activated event
  // (or any other duplicate delivery) — never re-notify for the latter.
  const { vendor: previous } = await getVendorProfile(userId).catch(() => ({ vendor: null }));
  const justActivated = status === "active" && previous?.razorpayAccountStatus !== "active";

  await setVendorRazorpayAccount(userId, {
    accountId: accountEntity.id,
    status,
    error: status === "active" ? null : `Razorpay status: ${accountEntity.status}`,
  }).catch((err) => console.error(`razorpay webhook: account status update failed for ${userId}:`, err));

  if (justActivated) {
    await notifyVendorPayoutsActive(userId);
  }
}
