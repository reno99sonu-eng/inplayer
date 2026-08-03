import {
  GetCommand,
  UpdateCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

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
