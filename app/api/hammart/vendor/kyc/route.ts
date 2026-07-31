import { NextRequest, NextResponse } from "next/server";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import {
  VENDORS_TABLE,
  VENDOR_KYC_DOCUMENTS_TABLE,
  getVendorProfile,
  vendorKycDocTypesFor,
  PAN_PATTERN,
  AADHAAR_PATTERN,
  PASSPORT_PATTERN,
  BANK_ACCOUNT_PATTERN,
  IFSC_PATTERN,
  GST_PATTERN,
  UDYAM_PATTERN,
  UPI_VPA_PATTERN,
  type VendorKycDocType,
} from "@/app/lib/hammartVendors";
import { KYC_DOCUMENT_DATA_URL_MAX_LENGTH } from "@/app/lib/imageCompress";

const MAX_DOCUMENT_LENGTH = KYC_DOCUMENT_DATA_URL_MAX_LENGTH * 1.2;

function isValidDocumentDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.length > 100 &&
    value.length <= MAX_DOCUMENT_LENGTH
  );
}

// Submit (or resubmit, after a rejection) a vendor's business-KYC packet.
// Mirrors app/api/creator/kyc/route.ts's shape exactly — see that file's
// comments for the full "why" of the manual-review / purge-after-decision
// policy this follows.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { vendor } = await getVendorProfile(user.userId);
  if (!vendor) {
    return NextResponse.json(
      { error: "Register as a vendor before submitting KYC." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const {
    legalName,
    panNumber,
    gstNumber,
    udyamNumber,
    addressLine1,
    city,
    state,
    pincode,
    idProofType,
    aadhaarNumber,
    passportNumber,
    bankAccountNumber,
    bankIfsc,
    upiId,
    vendorTermsAccepted,
    documents,
  } = body;

  if (!vendorTermsAccepted) {
    return NextResponse.json({ error: "You must accept the Hammart Vendor Terms to submit KYC." }, { status: 400 });
  }
  if (!legalName?.trim() || !addressLine1?.trim() || !city?.trim() || !state?.trim() || !pincode?.trim()) {
    return NextResponse.json({ error: "Please fill in every field." }, { status: 400 });
  }
  if (!PAN_PATTERN.test(String(panNumber || "").trim().toUpperCase())) {
    return NextResponse.json({ error: "That doesn't look like a valid PAN (format: ABCDE1234F)." }, { status: 400 });
  }
  if (!BANK_ACCOUNT_PATTERN.test(String(bankAccountNumber || "").trim())) {
    return NextResponse.json({ error: "Please enter a valid bank account number." }, { status: 400 });
  }
  if (!IFSC_PATTERN.test(String(bankIfsc || "").trim())) {
    return NextResponse.json({ error: "Please enter a valid IFSC code." }, { status: 400 });
  }
  if (!UPI_VPA_PATTERN.test(String(upiId || "").trim())) {
    return NextResponse.json(
      { error: "Please enter a valid UPI ID (e.g. yourname@okhdfcbank) — this is what buyers will pay directly." },
      { status: 400 }
    );
  }

  if (vendor.businessType === "individual") {
    if (idProofType !== "aadhaar" && idProofType !== "passport") {
      return NextResponse.json({ error: "Invalid ID proof type." }, { status: 400 });
    }
    if (idProofType === "aadhaar" && !AADHAAR_PATTERN.test(String(aadhaarNumber || "").trim())) {
      return NextResponse.json({ error: "Please enter a valid 12-digit Aadhaar number." }, { status: 400 });
    }
    if (idProofType === "passport" && !PASSPORT_PATTERN.test(String(passportNumber || "").trim())) {
      return NextResponse.json({ error: "Please enter a valid passport number." }, { status: 400 });
    }
  } else {
    const gst = String(gstNumber || "").trim().toUpperCase();
    const udyam = String(udyamNumber || "").trim().toUpperCase();
    const hasGst = gst && GST_PATTERN.test(gst);
    const hasUdyam = udyam && UDYAM_PATTERN.test(udyam);
    if (!hasGst && !hasUdyam) {
      return NextResponse.json(
        { error: "Please enter a valid GST number (e.g. 22AAAAA0000A1Z5) or Udyam registration number (e.g. UDYAM-KA-03-1234567)." },
        { status: 400 }
      );
    }
  }

  const requiredDocs = vendorKycDocTypesFor(vendor.businessType);
  if (!documents || typeof documents !== "object") {
    return NextResponse.json({ error: `Please upload all ${requiredDocs.length} documents.` }, { status: 400 });
  }
  for (const docType of requiredDocs) {
    if (!isValidDocumentDataUrl((documents as Record<string, unknown>)[docType])) {
      return NextResponse.json({ error: `Please upload all ${requiredDocs.length} documents as clear photos.` }, { status: 400 });
    }
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: VENDORS_TABLE,
        Key: { userId: user.userId },
        UpdateExpression:
          "SET kycStatus = :status, legalName = :legalName, panNumber = :panNumber, gstNumber = :gstNumber, udyamNumber = :udyamNumber, addressLine1 = :addressLine1, city = :city, #state = :state, pincode = :pincode, idProofType = :idProofType, aadhaarNumber = :aadhaarNumber, passportNumber = :passportNumber, bankAccountNumber = :bankAccountNumber, bankIfsc = :bankIfsc, upiId = :upiId, vendorTermsAccepted = :termsAccepted, vendorTermsAcceptedAt = :now, submittedAt = :now, updatedAt = :now REMOVE reviewedAt, reviewedBy, rejectionReason",
        ExpressionAttributeNames: { "#state": "state" },
        ExpressionAttributeValues: {
          ":status": "pending_review",
          ":legalName": legalName.trim(),
          ":panNumber": panNumber.trim().toUpperCase(),
          ":gstNumber": vendor.businessType === "business" && gstNumber ? String(gstNumber).trim().toUpperCase() : null,
          ":udyamNumber": vendor.businessType === "business" && udyamNumber ? String(udyamNumber).trim().toUpperCase() : null,
          ":addressLine1": addressLine1.trim(),
          ":city": city.trim(),
          ":state": state.trim(),
          ":pincode": pincode.trim(),
          ":idProofType": vendor.businessType === "individual" ? idProofType : null,
          ":aadhaarNumber": vendor.businessType === "individual" && idProofType === "aadhaar" ? String(aadhaarNumber).trim() : null,
          ":passportNumber": vendor.businessType === "individual" && idProofType === "passport" ? String(passportNumber).trim().toUpperCase() : null,
          ":bankAccountNumber": String(bankAccountNumber).trim(),
          ":bankIfsc": String(bankIfsc).trim().toUpperCase(),
          ":upiId": String(upiId).trim(),
          ":termsAccepted": true,
          ":now": new Date().toISOString(),
        },
      })
    );

    await Promise.all(
      requiredDocs.map((docType: VendorKycDocType) =>
        docClient.send(
          new PutCommand({
            TableName: VENDOR_KYC_DOCUMENTS_TABLE,
            Item: {
              userId: user.userId,
              docType,
              imageDataUrl: (documents as Record<string, string>)[docType],
              uploadedAt: new Date().toISOString(),
            },
          })
        )
      )
    );

    return NextResponse.json({ success: true, kycStatus: "pending_review" });
  } catch (err) {
    console.error("Vendor KYC submission failed — a required table may be unavailable:", err);
    return NextResponse.json(
      { error: "KYC submission isn't available yet. Please try again later." },
      { status: 503 }
    );
  }
}
