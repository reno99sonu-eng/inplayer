import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dynamodb";

// A sponsor's own reusable account details — separate from
// app/lib/sponsorships.ts's SPONSORSHIPS_TABLE (one row per PURCHASE).
// This is one row per USER: the company/contact/KYC info they'd otherwise
// have to retype on every single sponsorship they buy. Purely a
// convenience/profile layer — nothing here ever gates payment or activates
// an ad; each individual Sponsorship row keeps its own frozen copy of
// whatever was submitted at purchase time (see createSponsorshipOrder),
// exactly like a Hammart order keeps its own delivery address even if the
// buyer's saved address changes later.
export const SPONSOR_PROFILES_TABLE = "InPlayer-Sponsor-Profiles";

export interface SponsorProfileFields {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  legalName: string;
  panOrGst: string;
  businessAddress: string;
}

export interface SponsorProfile extends SponsorProfileFields {
  userId: string;
  updatedAt: string;
}

const EMPTY_FIELDS: SponsorProfileFields = {
  companyName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  websiteUrl: "",
  legalName: "",
  panOrGst: "",
  businessAddress: "",
};

export async function getSponsorProfile(userId: string): Promise<SponsorProfile | null> {
  try {
    const result = await docClient.send(
      new GetCommand({ TableName: SPONSOR_PROFILES_TABLE, Key: { userId } })
    );
    return (result.Item as SponsorProfile) || null;
  } catch (err) {
    console.error("sponsorProfiles: read failed (table may not exist yet):", err);
    return null;
  }
}

// Read-then-merge-then-Put, same convention as app/lib/platformSettings.ts's
// updatePlatformSettings — a partial save (e.g. just the Profile & Settings
// tab's form) never wipes out fields it didn't touch. `userId` and
// `updatedAt` are set LAST so they always win over anything a stale `current`
// or a caller-supplied `fields` object might otherwise carry.
export async function upsertSponsorProfile(
  userId: string,
  fields: Partial<SponsorProfileFields>
): Promise<SponsorProfile> {
  const current = await getSponsorProfile(userId);
  const merged: SponsorProfile = {
    ...EMPTY_FIELDS,
    ...(current || {}),
    ...fields,
    userId,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: SPONSOR_PROFILES_TABLE, Item: merged }));
  return merged;
}
