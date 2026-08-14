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
  hasGoodStanding: boolean;
  meetsSubscriberRequirement: boolean;
  meetsViewRequirement: boolean;
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
        if (item.contentType === "short") {
          shortViews += (item.views || 0);
        } else {
          videoViews += (item.views || 0);
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
    hasGoodStanding,
    meetsSubscriberRequirement,
    meetsViewRequirement
  };
}
