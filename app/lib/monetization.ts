// Phase 1: Monetization Architecture
// This service acts as the central Backend Monetization Service.
// It enforces all rules, ensuring the frontend never independently determines eligibility.

import { docClient } from "./dynamodb";
import { getPlatformSettings } from "./platformSettings";
import { ScanCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

export const MONETIZATION_CONFIG_HISTORY_TABLE = "InPlayer-Monetization-Config-History";
export const CREATOR_EARNINGS_TABLE = "InPlayer-Creator-Earnings";

export type MonetizationStatus =
  | "NOT_ELIGIBLE"
  | "ELIGIBLE"
  | "MONETIZED"
  | "SUSPENDED"
  | "DISABLED";

export type RevenueCategory =
  | "membership"
  | "advertising"
  | "promotions"
  | "affiliate"
  | "bonus";

export interface MonetizationState {
  status: MonetizationStatus;
  monetizedAt?: string;
  configVersion?: string;
  suspensionReason?: string;
}

export interface EarningRecord {
  earningId: string;
  creatorId: string;
  source: RevenueCategory;
  grossRevenueInr: number;
  creatorShareInr: number;
  platformShareInr: number;
  configVersion: string;
  createdAt: string;
  status: "pending" | "cleared" | "failed";
  referenceId?: string;
}

export interface MonetizationConfig {
  version: string;
  enabled: boolean;
  requiredSubscribers: number;
  requiredVideoViews: number;
  requiredShortViews: number;
  requireBoth: boolean;
  requireGoodStanding: boolean;
  creatorShare: number;
  platformShare: number;
  bonusEnabled: boolean;
  bonusPoolInr: number;
  maxBonusPerCreatorInr: number;
}

export interface EligibilityResult {
  isEligible: boolean;
  subscribers: number;
  videoViews: number;
  shortViews: number;
  /** Plays of audio-only uploads. A BREAKDOWN of videoViews, not a fourth
   *  milestone — see the counter below for why music has to stay inside
   *  the longform total. */
  musicViews: number;
  hasGoodStanding: boolean;
  meetsSubscriberRequirement: boolean;
  meetsViewRequirement: boolean;
  // ── Why these two extra groupings exist ────────────────────────────
  // This object is returned verbatim to the browser as
  // `eligibility` by app/api/creator/monetize/status/route.ts, and the
  // Revenue & KYC panel (app/components/analytics/RevenueSection.tsx)
  // reads its numbers as `eligibility.metrics.videoViews`,
  // `eligibility.thresholds.subscribers`, `eligibility.thresholds
  // .revenueShare` and so on — i.e. it expects them nested under
  // `metrics` and `thresholds`, which this type never actually had.
  //
  // Every one of those reads was therefore `undefined` and silently fell
  // back to the component's own hardcoded defaults (`|| 0` for the
  // creator's numbers, `|| 500` / `|| 50000` / `|| 1000000` for the
  // targets). That is the real cause of the reported bug: the Revenue &
  // KYC section always showed 0 views and 0 subscribers, while the
  // Dashboard tab showed the correct totals — the two panels read from
  // different endpoints, and only the Dashboard's happened to match its
  // consumer's expected shape.
  //
  // The flat fields above are kept exactly as they were so nothing that
  // already reads them (the eligibility engine's own callers, the
  // activate route) changes behavior — this is purely additive.
  metrics: {
    subscribers: number;
    videoViews: number;
    shortViews: number;
    musicViews: number;
  };
  thresholds: {
    subscribers: number;
    videoViews: number;
    shortViews: number;
    /** Creator's share as a fraction (0.8 = 80%), matching how the UI renders it. */
    revenueShare: number;
    requireBoth: boolean;
  };
}

// Phase 2: Monetization Eligibility Engine
// Calculates real-time eligibility directly from DynamoDB sources.
export async function checkMonetizationEligibility(userId: string): Promise<EligibilityResult> {
  const settings = await getPlatformSettings();

  // 1. Fetch Subscriber Count
  let subscribers = 0;
  try {
    const subsResult = await docClient.send(
      new QueryCommand({
        TableName: "InPlayer-Subscriptions",
        IndexName: "creatorId-index",
        KeyConditionExpression: "creatorId = :creatorId",
        ExpressionAttributeValues: { ":creatorId": userId },
        Select: "COUNT",
      })
    );
    subscribers = subsResult.Count || 0;
  } catch (err) {
    console.error(`Monetization Engine: Failed to load subscribers for ${userId}`, err);
  }

  // 2. Fetch Views (Split by video and short)
  let videoViews = 0;
  let shortViews = 0;
  // Music plays ALSO stay inside videoViews below — deliberately. The 50k
  // threshold is meant to be met by longform work of any kind, and
  // splitting music out of the total would mean a creator who publishes
  // only music could never qualify no matter how many plays they had. So:
  // same threshold, extra breakdown.
  let musicViews = 0;
  try {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const videosResult = await docClient.send(
        new ScanCommand({
          TableName: "InPlayer-Videos",
          FilterExpression: "uploaderId = :uploaderId",
          ExpressionAttributeValues: { ":uploaderId": userId },
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      
      for (const item of videosResult.Items || []) {
        const views = (item.views as number) || 0;
        if (item.contentType === "short") {
          shortViews += views;
        } else {
          videoViews += views;
          if (item.contentType === "music") musicViews += views;
        }
      }
      exclusiveStartKey = videosResult.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);
  } catch (err) {
    console.error(`Monetization Engine: Failed to scan videos for ${userId}`, err);
  }

  // 3. Check Good Standing (Suspension Status)
  let hasGoodStanding = true;
  try {
    const userResult = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId },
        ProjectionExpression: "isSuspended, suspendedUntil",
      })
    );
    
    if (userResult.Item) {
      const isSuspended = userResult.Item.isSuspended === true;
      const suspendedUntil = userResult.Item.suspendedUntil as string | undefined;
      const isTempBlocked = suspendedUntil ? new Date(suspendedUntil).getTime() > Date.now() : false;
      
      if (isSuspended || isTempBlocked) {
        hasGoodStanding = false;
      }
    }
  } catch (err) {
    console.error(`Monetization Engine: Failed to check standing for ${userId}`, err);
  }

  // 4. Engine Evaluation
  const meetsSubscriberRequirement = subscribers >= settings.monetizationRequiredSubscribers;
  
  // They either need enough video views OR enough shorts views.
  const meetsVideoViews = videoViews >= settings.monetizationRequiredVideoViews;
  const meetsShortViews = shortViews >= settings.monetizationRequiredShortViews;
  const meetsViewRequirement = meetsVideoViews || meetsShortViews;

  let isEligible = false;
  if (settings.monetizationRequireBoth) {
    isEligible = meetsSubscriberRequirement && meetsViewRequirement;
  } else {
    isEligible = meetsSubscriberRequirement || meetsViewRequirement;
  }

  if (settings.monetizationRequireGoodStanding && !hasGoodStanding) {
    isEligible = false;
  }
  
  if (!settings.monetizationEnabled) {
    isEligible = false;
  }

  return {
    isEligible,
    subscribers,
    videoViews,
    shortViews,
    musicViews,
    hasGoodStanding,
    meetsSubscriberRequirement,
    meetsViewRequirement,
    // Same real numbers as above, in the shape the Revenue & KYC panel
    // actually reads (see the interface comment) — these are what make
    // that panel show the creator's true views/subscribers and the real
    // admin-configured targets instead of zeros and hardcoded defaults.
    metrics: {
      subscribers,
      videoViews,
      shortViews,
      musicViews,
    },
    thresholds: {
      subscribers: settings.monetizationRequiredSubscribers,
      videoViews: settings.monetizationRequiredVideoViews,
      shortViews: settings.monetizationRequiredShortViews,
      revenueShare: settings.monetizationCreatorShare,
      requireBoth: settings.monetizationRequireBoth,
    },
  };
}
