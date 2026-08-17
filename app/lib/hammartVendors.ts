import {
  GetCommand,
  UpdateCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { sendEmail } from "@/app/lib/ses";
import { resolveCognitoEmails } from "@/app/lib/cognitoClient";

// Hammart is InPlayer's marketplace. This file is the vendor-account
// foundation everything else (product listings, KYC, checkout, admin
// review) is built on top of. Deliberately kept in its own table
// namespace ("Hammart-...") rather than mixed into InPlayer-Users, since a
// vendor is a distinct object with its own lifecycle (KYC, subscription,
// suspension) that most InPlayer-Users rows will never have.
//
// Same tableMissing convention as everywhere else in this codebase (see
// app/lib/sessions.ts) — these tables are NOT created via IaC. Reno has to
// create them by hand in the AWS DynamoDB console. Every function here
// fails soft (never throws over a missing table) so the rest of the app
// keeps working even before that manual step happens.

export const VENDORS_TABLE = "Hammart-Vendors"; // PK: userId
export const VENDOR_IDS_TABLE = "Hammart-Vendor-Ids"; // PK: vendorIdLower — uniqueness reservation, mirrors InPlayer-Usernames
// Idempotency ledger for the vendor's own ₹249/month platform-fee charges
// (see app/api/webhooks/razorpay/route.ts's handleVendorCharged) — same
// "key on Razorpay's own payment id" pattern as InPlayer-Revenue-Ledger.
export const VENDOR_SUBSCRIPTION_LEDGER_TABLE = "Hammart-Vendor-Subscription-Ledger"; // PK: razorpayPaymentId

export const PRODUCT_LISTING_FEE_INR = 0.50; // ₹0.50 per product listing for InPlayer platform
export const UNLIMITED_LISTINGS = true;
export const FREE_LISTINGS_LIMIT = Infinity; // Unlimited listings model
export const VENDOR_SUBSCRIPTION_PRICE_INR = 0.50;

export type BusinessType = "individual" | "business";
export type VendorKycStatus = "not_started" | "pending_review" | "verified" | "rejected";
export type VendorSubscriptionStatus = "free" | "active" | "expired";

// The vendor's Razorpay Route "Linked Account" — an OPTIONAL upgrade that
// lets a buyer's payment for one of their products split automatically
// (minus PLATFORM_COMMISSION_PER_ORDER_INR) straight to their own bank
// account, with no manual transfer step. Never required to sell — a
// vendor who isn't "active" here simply keeps using the direct-UPI
// checkout fallback (see app/api/hammart/checkout/route.ts's header
// comment). See app/lib/razorpay.ts's createLinkedAccount/
// fetchLinkedAccount and app/api/webhooks/razorpay/route.ts's account.*
// handlers.
//
//   not_started — no attempt made yet (vendor not KYC-verified, or this
//                 feature didn't exist yet when they were approved) —
//                 checkout for this vendor uses the UPI fallback
//   pending     — account created at Razorpay, awaiting Razorpay's own
//                 underwriting/activation — CANNOT receive a transfer yet,
//                 checkout still uses the UPI fallback
//   active      — Razorpay has activated it; checkout for this vendor
//                 uses the real Razorpay path (see app/api/hammart/
//                 checkout/route.ts)
//   failed      — creation or activation failed; see razorpayAccountError.
//                 Checkout falls back to UPI, same as "pending" — never
//                 "fails open" into a Razorpay payment with nowhere real
//                 for the vendor's share to land.
export type RazorpayLinkedAccountStatus = "not_started" | "pending" | "active" | "failed";

export interface VendorProfile {
  userId: string;
  vendorId: string;
  vendorIdLower: string;
  businessType: BusinessType;
  businessName: string | null;
  kycStatus: VendorKycStatus;
  vendorTermsAccepted: boolean;
  vendorTermsAcceptedAt: string | null;
  subscriptionStatus: VendorSubscriptionStatus;
  freeListingsUsed: number;
  upiId: string | null;
  suspended: boolean;
  razorpaySubscriptionId?: string | null;
  lastChargedAt?: string | null;
  razorpayAccountId?: string | null;
  razorpayAccountStatus?: RazorpayLinkedAccountStatus;
  razorpayAccountError?: string | null;
  whatsappNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 3-30 chars, lowercase letters/numbers/hyphens, must start with a letter
// — a public-facing storefront slug (inplayer.in/shop/<vendorId>), so kept
// stricter/URL-safe compared to the general username pattern.
export const VENDOR_ID_PATTERN = /^[a-z][a-z0-9-]{2,29}$/;

const RESERVED_VENDOR_IDS = [
  "admin",
  "official",
  "inplayer",
  "hammart",
  "support",
  "help",
  "api",
  "checkout",
  "cart",
  "new",
  "settings",
];

export function normalizeVendorId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidVendorIdFormat(raw: string): boolean {
  return VENDOR_ID_PATTERN.test(raw.trim());
}

export function isReservedVendorId(lower: string): boolean {
  return RESERVED_VENDOR_IDS.includes(lower);
}

async function vendorIdOwner(vendorIdLower: string): Promise<string | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: VENDOR_IDS_TABLE, Key: { vendorIdLower } })
  );
  return (result.Item?.userId as string | undefined) || null;
}

// Used by the live-availability checker on the signup form (runs BEFORE
// an account exists, so this must not require auth) and re-checked
// server-side at actual registration time to close the TOCTOU gap.
export async function checkVendorIdAvailable(
  raw: string
): Promise<{ available: boolean; reason?: string; tableMissing?: boolean }> {
  if (!isValidVendorIdFormat(raw)) {
    return {
      available: false,
      reason: "3-30 characters, starting with a letter — lowercase letters, numbers, and hyphens only.",
    };
  }

  const lower = normalizeVendorId(raw);

  if (isReservedVendorId(lower)) {
    return { available: false, reason: "That vendor ID is reserved." };
  }

  try {
    const owner = await vendorIdOwner(lower);
    if (owner) {
      return { available: false, reason: "That vendor ID is already taken." };
    }
    return { available: true };
  } catch (err) {
    console.error("checkVendorIdAvailable: lookup failed (table may not exist yet):", err);
    return {
      available: false,
      reason: "Vendor ID checking isn't available yet. Please try again shortly.",
      tableMissing: true,
    };
  }
}

export async function getVendorProfile(
  userId: string
): Promise<{ vendor: VendorProfile | null; tableMissing: boolean }> {
  try {
    const result = await docClient.send(
      new GetCommand({ TableName: VENDORS_TABLE, Key: { userId } })
    );
    return { vendor: (result.Item as VendorProfile) || null, tableMissing: false };
  } catch (err) {
    console.error("getVendorProfile: lookup failed (table may not exist yet):", err);
    return { vendor: null, tableMissing: true };
  }
}

export interface CreateVendorInput {
  userId: string;
  vendorId: string;
  businessType: BusinessType;
  businessName: string | null;
}

// Creates the vendor row AND reserves the vendorId atomically (one fails,
// both fail) via a DynamoDB transaction, so two people racing on the same
// vendorId can never both win — the loser gets a clear "already taken"
// instead of a silently overwritten reservation.
export async function createVendorProfile(
  input: CreateVendorInput
): Promise<{ success: boolean; reason?: string; tableMissing?: boolean }> {
  const vendorIdLower = normalizeVendorId(input.vendorId);

  if (!isValidVendorIdFormat(input.vendorId) || isReservedVendorId(vendorIdLower)) {
    return { success: false, reason: "Invalid vendor ID." };
  }

  const now = new Date().toISOString();
  const profile: VendorProfile = {
    userId: input.userId,
    vendorId: input.vendorId.trim(),
    vendorIdLower,
    businessType: input.businessType,
    businessName: input.businessName,
    kycStatus: "not_started",
    vendorTermsAccepted: false,
    vendorTermsAcceptedAt: null,
    subscriptionStatus: "free",
    freeListingsUsed: 0,
    upiId: null,
    whatsappNumber: null,
    suspended: false,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: VENDOR_IDS_TABLE,
              Item: { vendorIdLower, userId: input.userId },
              ConditionExpression: "attribute_not_exists(vendorIdLower)",
            },
          },
          {
            Put: {
              TableName: VENDORS_TABLE,
              Item: profile,
              ConditionExpression: "attribute_not_exists(userId)",
            },
          },
        ],
      })
    );
    return { success: true };
  } catch (err) {
    console.error("createVendorProfile: transaction failed:", err);
    const message = err instanceof Error ? err.message : "";
    if (message.includes("ConditionalCheckFailed")) {
      return { success: false, reason: "That vendor ID was just taken, or you already have a vendor account." };
    }
    return {
      success: false,
      reason: "Vendor accounts aren't set up yet — please try again shortly.",
      tableMissing: true,
    };
  }
}

// Records the outcome of a Razorpay Route linked-account attempt — called
// right after admin approval (app/api/admin/hammart-vendors/route.ts) and
// by the admin "retry"/"sync" actions, plus by the webhook's account.*
// handlers once Razorpay itself reports a status change. Never throws on
// its own — callers already wrap Razorpay calls in try/catch and decide
// what to store based on success/failure, so this is just the write.
//
// `accountId` is optional on purpose: a pure status refresh (e.g. the
// webhook telling us an already-created account just got activated) has
// no reason to touch the existing id — only pass it when you actually
// have a new/confirmed value.
export async function setVendorRazorpayAccount(
  userId: string,
  update: { accountId?: string | null; status: RazorpayLinkedAccountStatus; error?: string | null }
): Promise<void> {
  const setExpressionParts = ["razorpayAccountStatus = :status", "razorpayAccountError = :error", "updatedAt = :now"];
  const values: Record<string, unknown> = {
    ":status": update.status,
    ":error": update.error ?? null,
    ":now": new Date().toISOString(),
  };
  if (update.accountId !== undefined) {
    setExpressionParts.push("razorpayAccountId = :accountId");
    values[":accountId"] = update.accountId;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: VENDORS_TABLE,
      Key: { userId },
      UpdateExpression: `SET ${setExpressionParts.join(", ")}`,
      ExpressionAttributeValues: values,
    })
  );
}

// Swiggy/Zomato-style "you're live" notice — call this exactly once, the
// moment a vendor's Razorpay Route linked account first reaches "active"
// (never on a duplicate/no-op status write). There are two call sites that
// can genuinely flip a vendor to "active": the account.activated webhook
// (app/api/webhooks/razorpay/route.ts, the common path) and the admin
// panel's manual "Check status" sync (app/api/admin/hammart-vendors/
// route.ts, the fallback for whenever that webhook event is missed) — both
// import this instead of duplicating the email. Never throws: the same
// status is already visible on the vendor's own dashboard
// (app/shop/vendor/page.tsx) the next time they load it, so a failed email
// here is a missed convenience, not a missed source of truth.
export async function notifyVendorPayoutsActive(vendorUserId: string): Promise<void> {
  try {
    const emailMap = await resolveCognitoEmails([vendorUserId]);
    const vendorEmail = emailMap.get(vendorUserId);
    if (!vendorEmail) return;
    await sendEmail({
      to: vendorEmail,
      subject: "🎉 Instant payouts are now active on your Hammart store",
      text: `Good news — Razorpay has approved automatic payouts for your Hammart store.\n\nFrom now on, buyers can pay you by card, netbanking, or any UPI app (not just UPI QR), and your share of every order (after InPlayer's flat ₹0.50 fee) lands straight in your bank account the moment payment is captured — no manual step needed.\n\nYou can see this status anytime on your Vendor Dashboard.`,
      html: `<h2>Instant payouts are now active 🎉</h2><p>Razorpay has approved automatic payouts for your Hammart store.</p><p>From now on, buyers can pay you by card, netbanking, or any UPI app (not just UPI QR), and your share of every order (after InPlayer's flat ₹0.50 fee) lands straight in your bank account the moment payment is captured — no manual step needed.</p><p>You can see this status anytime on your Vendor Dashboard.</p>`,
    });
  } catch (err) {
    console.error(`notifyVendorPayoutsActive: email failed for ${vendorUserId}:`, err);
  }
}

export async function acceptVendorTerms(userId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: VENDORS_TABLE,
      Key: { userId },
      UpdateExpression: "SET vendorTermsAccepted = :t, vendorTermsAcceptedAt = :at, updatedAt = :u",
      ExpressionAttributeValues: {
        ":t": true,
        ":at": new Date().toISOString(),
        ":u": new Date().toISOString(),
      },
    })
  );
}

export async function setVendorWhatsappNumber(userId: string, whatsappNumber: string | null): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: VENDORS_TABLE,
      Key: { userId },
      UpdateExpression: "SET whatsappNumber = :w, updatedAt = :u",
      ExpressionAttributeValues: {
        ":w": whatsappNumber,
        ":u": new Date().toISOString(),
      },
    })
  );
}

// --- Vendor business KYC ------------------------------------------------
//
// Same shape/policy as the creator KYC flow (app/api/creator/kyc,
// app/lib/creatorPayouts.ts): a real person on the InPlayer team reviews
// every submission by hand. Once approved/rejected, the photos are purged
// (Hammart-Vendor-KYC-Documents) and the street address is stripped from
// the surviving row — what's left permanently is a minimal text audit
// trail (legal name, PAN, GST/Udyam number, bank details, UPI ID), never
// the underlying photos or address "just in case." A vendor cannot
// publish a product listing until kycStatus === "verified" (enforced
// wherever listings are created, not here).
//
// Individual vs business submissions collect different documents:
//   individual: pan_card, id_proof (Aadhaar or Passport), bank_proof, selfie
//   business:   pan_card, business_proof (GST certificate or Udyam
//               registration certificate), bank_proof, selfie (of the
//               authorized signatory)
export const VENDOR_KYC_DOCUMENTS_TABLE = "Hammart-Vendor-KYC-Documents"; // PK: userId, SK: docType

export const VENDOR_KYC_DOC_TYPES_INDIVIDUAL = ["pan_card", "id_proof", "bank_proof", "selfie"] as const;
export const VENDOR_KYC_DOC_TYPES_BUSINESS = ["pan_card", "business_proof", "bank_proof", "selfie"] as const;
export type VendorKycDocType =
  | (typeof VENDOR_KYC_DOC_TYPES_INDIVIDUAL)[number]
  | (typeof VENDOR_KYC_DOC_TYPES_BUSINESS)[number];

export function vendorKycDocTypesFor(businessType: BusinessType): readonly VendorKycDocType[] {
  return businessType === "business" ? VENDOR_KYC_DOC_TYPES_BUSINESS : VENDOR_KYC_DOC_TYPES_INDIVIDUAL;
}

// Format validation only — same honest caveat as the creator KYC flow.
// Nothing here is checked against a live government database; a human
// admin is the one actually verifying these against the uploaded photos.
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR_PATTERN = /^\d{12}$/;
export const PASSPORT_PATTERN = /^[A-Za-z0-9]{6,9}$/;
export const BANK_ACCOUNT_PATTERN = /^\d{9,18}$/;
export const IFSC_PATTERN = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;
export const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const UDYAM_PATTERN = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
export const UPI_VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export interface VendorKycRow {
  userId: string;
  kycStatus: VendorKycStatus;
  legalName: string;
  panNumber: string;
  gstNumber: string | null;
  udyamNumber: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  idProofType: "aadhaar" | "passport" | null;
  aadhaarNumber: string | null;
  passportNumber: string | null;
  bankAccountNumber: string;
  bankIfsc: string;
  upiId: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}
