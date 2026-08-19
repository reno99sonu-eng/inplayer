import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { PREMIUM_PLANS, type PremiumPlanId } from "@/app/lib/premiumPlans";

// Turning a confirmed Razorpay payment into Premium time.
//
// The ONLY caller is app/api/webhooks/razorpay/route.ts's payment.captured
// handler — same rule the rest of the codebase already follows: a route the
// browser can reach never marks anything paid, because a browser can lie
// about a payment. Razorpay's signed webhook is the only thing that can.
//
// No new table. Premium is one `premiumUntil` ISO date on the user's
// existing InPlayer-Users row, exactly as app/lib/premium.ts's
// isPremiumFromRecord already reads it and Admin → Users already writes it.
const USERS_TABLE = "InPlayer-Users";

export type GrantOutcome = "granted" | "duplicate" | "failed";

// EXTENDS rather than overwrites. Someone who buys a year while three weeks
// of a monthly plan are still running gets 365 days added to the END of
// that, not their remaining time thrown away. An expired (or absent) date
// counts as "starts now".
export function extendedExpiry(
  currentUntil: unknown,
  durationDays: number,
  now: number
): string {
  const parsed = typeof currentUntil === "string" ? new Date(currentUntil).getTime() : NaN;
  const base = Number.isFinite(parsed) && parsed > now ? parsed : now;
  return new Date(base + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

// IDEMPOTENCY: Razorpay retries webhooks, and will happily deliver the same
// payment.captured more than once. Each granted payment id is recorded in a
// `premiumPayments` map on the row, and the write is conditional on that id
// being absent — so a redelivery is refused by DynamoDB rather than quietly
// handing out a second month. This is the same failure the Hammart and
// sponsorship handlers avoid by only ever moving a status forward.
export async function grantPremiumFromPayment(params: {
  userId: string;
  planId: PremiumPlanId;
  paymentId: string;
}): Promise<GrantOutcome> {
  const plan = PREMIUM_PLANS[params.planId];
  if (!plan || !params.userId || !params.paymentId) return "failed";

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  try {
    const existing = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId: params.userId },
        ProjectionExpression: "premiumUntil",
      })
    );

    const premiumUntil = extendedExpiry(existing.Item?.premiumUntil, plan.durationDays, now);

    // Two writes on purpose. DynamoDB can't SET a nested path inside a map
    // that doesn't exist yet, so the map is created first (unconditionally,
    // harmless if it's already there) and only then is the guarded write
    // attempted.
    await docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId: params.userId },
        UpdateExpression: "SET premiumPayments = if_not_exists(premiumPayments, :empty)",
        ExpressionAttributeValues: { ":empty": {} },
      })
    );

    await docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId: params.userId },
        UpdateExpression:
          "SET premiumUntil = :until, premiumPlan = :plan, premiumPayments.#pid = :paidAt, updatedAt = :now",
        ConditionExpression: "attribute_not_exists(premiumPayments.#pid)",
        ExpressionAttributeNames: { "#pid": params.paymentId },
        ExpressionAttributeValues: {
          ":until": premiumUntil,
          ":plan": params.planId,
          ":paidAt": nowIso,
          ":now": nowIso,
        },
      })
    );

    return "granted";
  } catch (err) {
    if ((err as { name?: string })?.name === "ConditionalCheckFailedException") {
      // Already granted for this payment — a webhook redelivery, not a bug.
      return "duplicate";
    }
    console.error(`grantPremiumFromPayment failed for ${params.userId}:`, err);
    return "failed";
  }
}

/** Reads back the date a grant landed on, for confirmation emails/UI. */
export async function readPremiumUntil(userId: string): Promise<string | null> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        ProjectionExpression: "premiumUntil",
      })
    );
    const until = result.Item?.premiumUntil;
    return typeof until === "string" ? until : null;
  } catch {
    return null;
  }
}
