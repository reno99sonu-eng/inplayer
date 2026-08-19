import { GetCommand, PutCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "./dynamodb";

// Real paid ad-sponsorship orders — a sponsor pays InPlayer directly (one
// flat charge into InPlayer's own Razorpay balance, see createPlainOrder in
// app/lib/razorpay.ts) to run their own creative in one or more existing ad
// slots for a fixed 7-day window. Deliberately NOT built on Razorpay Route:
// there's no third party being paid here at all — a sponsor pays InPlayer,
// InPlayer is the sole merchant of record on the charge — so none of the
// RBI turnover-threshold restriction that blocks Hammart vendor payouts
// applies to this feature (see claude/website-fixes-log.md entry on that).
//
// One row per purchase. This table only tracks the ORDER (who, what
// package, paid or not, KYC, lifecycle status) — the actual ad creative
// (image/video + link) a sponsor's campaign runs lives in the existing
// app/lib/adCreatives.ts (InPlayer-Ad-Creatives, for the two banner slots)
// or app/lib/videoAds.ts (InPlayer-Midroll-Ads, for the mid-roll slot)
// tables, tagged with this row's sponsorshipId — see "Linking a creative"
// below. Reusing those tables (rather than inventing a third, parallel
// rendering pipeline) is what makes a sponsor's ad show up correctly with
// zero new rendering code: the exact same cached-scan/rotate/click-track
// logic every house ad already uses just picks it up too.
export const SPONSORSHIPS_TABLE = "InPlayer-Sponsorships";

// Every mid-roll / homepage-banner / watch-banner ad slot that already
// exists in the app — a sponsor buys the right to run their creative in
// one, some, or (via the "bundle" package) all three for SPONSORSHIP_
// DURATION_DAYS. This is intentionally the same three slots Admin ->
// Advertising already controls; a sponsor's paid creative rotates
// alongside whatever house creatives an admin has also uploaded for that
// same slot, not a separate/parallel display.
export type SponsorshipSection = "midroll" | "homepage_banner" | "watch_banner";

export type SponsorshipPackageType = "bundle" | SponsorshipSection;

export const SPONSORSHIP_DURATION_DAYS = 7;

export interface SponsorshipPackage {
  packageType: SponsorshipPackageType;
  label: string;
  sections: SponsorshipSection[];
  amountInr: number;
  description: string;
  /** What a sponsor GETS. This is what the public pricing grid shows in
   *  place of the price — see the note on amountInr below. */
  benefits: string[];
}

// WHERE THE PRICE IS ALLOWED TO APPEAR: nowhere public. The packages API
// strips amountInr for unauthenticated callers, and the pricing grid never
// renders it at all — a visitor sees `benefits` instead, and the figure
// only appears on the checkout screen, once they have signed in and picked
// a package. Same principle already applied to SPONSORSHIP_ASSET_SPECS
// below: a sponsor learns the commercial detail when they commit, not from
// a public rate card competitors can read.
//
// Pricing exactly as specified — the "bundle" (all three sections) is
// priced at a flat ₹7,000 even though buying the three individual sections
// separately would total ₹6,100. That's an intentional business call (a
// sponsor who wants the simplicity of "just run everywhere" pays a small
// premium for not having to think about which sections to pick), not a
// bug — kept exactly as written rather than "corrected" to match the sum.
export const SPONSORSHIP_PACKAGES: Record<SponsorshipPackageType, SponsorshipPackage> = {
  bundle: {
    packageType: "bundle",
    label: "Entire InPlayer",
    sections: ["midroll", "homepage_banner", "watch_banner"],
    amountInr: 7000,
    description: "Your ad runs in all three placements below — mid-roll video, homepage banner, and watch-page banner — for 7 days.",
    benefits: [
      "Runs in all three placements at once — mid-roll, homepage banner and watch-page banner",
      "The widest reach InPlayer sells: every visitor, every watch page, every video break",
      "One creative set, one invoice, one 7-day window",
      "Cheaper than buying the three placements separately",
      "Live views and clicks in your Sponsorship Dashboard",
    ],
  },
  midroll: {
    packageType: "midroll",
    label: "Mid-Roll Video Ad",
    sections: ["midroll"],
    amountInr: 2500,
    description: "Your video plays as a full-screen mid-roll break inside InPlayer videos for 7 days.",
    benefits: [
      "A full-screen break inside videos people are already watching",
      "Plays in the same slot as InPlayer's own ads — not a sidebar people scroll past",
      "Your video, your link, 7 days",
      "Live views and clicks in your Sponsorship Dashboard",
    ],
  },
  homepage_banner: {
    packageType: "homepage_banner",
    label: "Homepage Banner",
    sections: ["homepage_banner"],
    amountInr: 1800,
    description: "Your creative rotates in the homepage banner slot for 7 days.",
    benefits: [
      "Front page — seen by everyone who opens InPlayer, signed in or not",
      "Rotates in the same banner slot InPlayer uses for its own campaigns",
      "Your creative, your link, 7 days",
      "Live views and clicks in your Sponsorship Dashboard",
    ],
  },
  watch_banner: {
    packageType: "watch_banner",
    label: "Watch Page Banner",
    sections: ["watch_banner"],
    amountInr: 1800,
    description: "Your creative rotates in the watch-page banner slot for 7 days.",
    benefits: [
      "Sits beside the video on every watch page, where attention already is",
      "Rotates in the same banner slot InPlayer uses for its own campaigns",
      "Your creative, your link, 7 days",
      "Live views and clicks in your Sponsorship Dashboard",
    ],
  },
};

// Per-section asset specs — deliberately kept out of the public pricing
// page and only returned by the API once a sponsor's order is actually
// paid for (see app/api/sponsorships/[sponsorshipId]/route.ts), matching
// "poster specs and ratios only shows up to the sponsor when they
// purchase". Sponsors don't upload through the website at all — they
// email these assets to inplayerdigital@gmail.com (InPlayer's own admin
// inbox — see HARDCODED_ADMIN_EMAILS in app/lib/isAdmin.ts) referencing
// their sponsorshipId, and an admin uploads them into Admin ->
// Sponsorships to activate the campaign (see app/admin/sponsorships).
export const SPONSORSHIP_ASSET_SPECS: Record<SponsorshipSection, { assetType: string; count: string; ratio: string; notes: string }> = {
  midroll: {
    assetType: "1 video (MP4 or WebM)",
    count: "Exactly 1 file",
    ratio: "16:9 landscape, 1920×1080 recommended",
    notes: "Max file size 50MB — keep it well-compressed (H.264, moderate bitrate) so it loads instantly mid-playback. Videos over 50MB will be rejected.",
  },
  homepage_banner: {
    assetType: "Images (JPG or PNG)",
    count: "Up to 3 — they auto-rotate every few seconds",
    ratio: "Mobile: 3:2 portrait-ish (e.g. 900×1200). Desktop/TV: wide 21:9 (e.g. 2100×900)",
    notes: "Submit both a mobile and a desktop crop of each image if you have them — InPlayer shows the right one per device automatically.",
  },
  watch_banner: {
    assetType: "Images (JPG or PNG)",
    count: "Up to 3 — they auto-rotate every few seconds",
    ratio: "Mobile: 3:2 portrait-ish (e.g. 900×1200). Desktop/TV: wide 21:9 (e.g. 2100×900)",
    notes: "Same specs as the homepage banner — this slot sits above the video on the watch page.",
  },
};

export type SponsorshipPaymentStatus = "pending" | "paid" | "failed";

// pending_payment -> (webhook confirms real payment) -> awaiting_assets ->
// (admin uploads the emailed creative and activates it) -> active ->
// (7 days after activatedAt, the daily cron flips it) -> expired.
// cancelled is a manual admin action (e.g. a sponsor's assets never showed
// up, or they asked for a refund) — never automatic.
export type SponsorshipStatus = "pending_payment" | "awaiting_assets" | "active" | "expired" | "cancelled";

export interface Sponsorship {
  sponsorshipId: string;
  userId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string; // where a click on this sponsor's ad redirects to
  packageType: SponsorshipPackageType;
  sections: SponsorshipSection[];
  amountInr: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paymentStatus: SponsorshipPaymentStatus;
  // KYC details collected as part of registration (plain business-identity
  // fields, not uploaded documents) — visible to InPlayer's admin, and to
  // the sponsor themselves in their own panel.
  legalName: string;
  panOrGst: string;
  businessAddress: string;
  status: SponsorshipStatus;
  activatedAt: string | null;
  expiresAt: string | null;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSponsorshipParams {
  userId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  packageType: SponsorshipPackageType;
  legalName: string;
  panOrGst: string;
  businessAddress: string;
}

export async function createSponsorshipOrder(params: CreateSponsorshipParams): Promise<Sponsorship> {
  const pkg = SPONSORSHIP_PACKAGES[params.packageType];
  if (!pkg) throw new Error("Unknown sponsorship package.");

  const now = new Date().toISOString();
  const sponsorship: Sponsorship = {
    sponsorshipId: randomUUID(),
    userId: params.userId,
    companyName: params.companyName.trim().slice(0, 200),
    contactName: params.contactName.trim().slice(0, 120),
    contactEmail: params.contactEmail.trim().toLowerCase().slice(0, 200),
    contactPhone: params.contactPhone.trim().slice(0, 30),
    websiteUrl: params.websiteUrl.trim().slice(0, 500),
    packageType: params.packageType,
    sections: pkg.sections,
    amountInr: pkg.amountInr,
    paymentStatus: "pending",
    legalName: params.legalName.trim().slice(0, 200),
    panOrGst: params.panOrGst.trim().toUpperCase().slice(0, 20),
    businessAddress: params.businessAddress.trim().slice(0, 500),
    status: "pending_payment",
    activatedAt: null,
    expiresAt: null,
    adminNotes: "",
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({ TableName: SPONSORSHIPS_TABLE, Item: sponsorship }));
  return sponsorship;
}

export async function attachRazorpayOrder(sponsorshipId: string, razorpayOrderId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: SPONSORSHIPS_TABLE,
      Key: { sponsorshipId },
      UpdateExpression: "SET razorpayOrderId = :orderId, updatedAt = :now",
      ExpressionAttributeValues: { ":orderId": razorpayOrderId, ":now": new Date().toISOString() },
    })
  );
}

// Called ONLY from the Razorpay webhook (app/api/webhooks/razorpay/route.ts)
// once payment.captured actually lands — same "webhook is the only source
// of truth for real money" convention as every other payment path in this
// app. Idempotent by nature: re-running this for an already-paid order is
// harmless (same conditional-write-free approach as markOrderPaid, since
// the webhook route itself already has its own payment-id idempotency
// gate before calling this).
export async function markSponsorshipPaid(sponsorshipId: string, razorpayPaymentId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: SPONSORSHIPS_TABLE,
      Key: { sponsorshipId },
      UpdateExpression: "SET paymentStatus = :paid, #status = :awaiting, razorpayPaymentId = :paymentId, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":paid": "paid",
        ":awaiting": "awaiting_assets",
        ":paymentId": razorpayPaymentId,
        ":now": new Date().toISOString(),
      },
    })
  );
}

export async function markSponsorshipPaymentFailed(sponsorshipId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: SPONSORSHIPS_TABLE,
      Key: { sponsorshipId },
      UpdateExpression: "SET paymentStatus = :failed, updatedAt = :now",
      ExpressionAttributeValues: { ":failed": "failed", ":now": new Date().toISOString() },
    })
  );
}

export async function getSponsorship(sponsorshipId: string): Promise<Sponsorship | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: SPONSORSHIPS_TABLE, Key: { sponsorshipId } })
  );
  return (result.Item as Sponsorship) || null;
}

// Every sponsorship a signed-in user has ever purchased — powers their own
// "Sponsorship Panel" (app/sponsorships/dashboard). No GSI on userId yet
// (this feature won't have enough rows for a Scan+filter to matter for a
// long while — same call this app already makes for several other
// low-volume tables), so this is a full scan filtered in memory.
export async function listSponsorshipsForUser(userId: string): Promise<Sponsorship[]> {
  const items = await scanAllSponsorships();
  return items
    .filter((s) => s.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function scanAllSponsorships(): Promise<Sponsorship[]> {
  const items: Sponsorship[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({ TableName: SPONSORSHIPS_TABLE, ExclusiveStartKey: exclusiveStartKey })
    );
    items.push(...((result.Items || []) as Sponsorship[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

// Admin-only, full list — used by app/admin/sponsorships/page.tsx. Not
// cached (unlike the public ad-rendering scans) since this is a low-traffic
// admin-only read, not something every visitor's page load hits.
export async function listAllSponsorshipsForAdmin(): Promise<Sponsorship[]> {
  const items = await scanAllSponsorships();
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Admin activates a paid order once they've uploaded the sponsor's emailed
// creative(s) into the relevant ad-rendering table(s) (see
// app/api/admin/sponsorships/[sponsorshipId]/activate/route.ts) — this is
// what actually starts the real 7-day clock. Deliberately a separate step
// from "payment received": a sponsor can pay before their assets ever
// arrive by email, and the 7 days they're paying for should only start
// once their ad is genuinely live, not the moment money changed hands.
export async function activateSponsorship(sponsorshipId: string): Promise<Sponsorship> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SPONSORSHIP_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await docClient.send(
    new UpdateCommand({
      TableName: SPONSORSHIPS_TABLE,
      Key: { sponsorshipId },
      UpdateExpression: "SET #status = :active, activatedAt = :activatedAt, expiresAt = :expiresAt, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":active": "active",
        ":activatedAt": now.toISOString(),
        ":expiresAt": expiresAt.toISOString(),
        ":now": now.toISOString(),
      },
    })
  );

  const updated = await getSponsorship(sponsorshipId);
  if (!updated) throw new Error("Sponsorship not found after activation.");
  return updated;
}

export async function cancelSponsorship(sponsorshipId: string, reason: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: SPONSORSHIPS_TABLE,
      Key: { sponsorshipId },
      UpdateExpression: "SET #status = :cancelled, adminNotes = :reason, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":cancelled": "cancelled",
        ":reason": reason.slice(0, 500),
        ":now": new Date().toISOString(),
      },
    })
  );
}

// Called once a day by app/api/cron/expire-sponsorships (see vercel.json) —
// flips every "active" sponsorship whose 7 days are up to "expired". This
// only updates the order row's own status (for the admin/sponsor panels to
// display); the actual ad creative rows in InPlayer-Ad-Creatives /
// InPlayer-Midroll-Ads carry their own copy of expiresAt and are filtered
// out of rotation directly by that timestamp (see app/lib/adCreatives.ts /
// app/lib/videoAds.ts) — so an ad stops showing to real visitors the
// instant its 7 days are up regardless of whether this daily cron has run
// yet; this just keeps the order's own status honest for the humans
// looking at it.
export async function expireDueSponsorships(): Promise<{ expiredCount: number; sponsorshipIds: string[] }> {
  const all = await scanAllSponsorships();
  const now = Date.now();
  const due = all.filter(
    (s) => s.status === "active" && s.expiresAt && new Date(s.expiresAt).getTime() <= now
  );

  await Promise.all(
    due.map((s) =>
      docClient.send(
        new UpdateCommand({
          TableName: SPONSORSHIPS_TABLE,
          Key: { sponsorshipId: s.sponsorshipId },
          UpdateExpression: "SET #status = :expired, updatedAt = :now",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":expired": "expired", ":now": new Date().toISOString() },
        })
      ).catch((err) => console.error(`expireDueSponsorships: failed for ${s.sponsorshipId}:`, err))
    )
  );

  return { expiredCount: due.length, sponsorshipIds: due.map((s) => s.sponsorshipId) };
}
