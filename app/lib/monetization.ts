// Phase 1: Monetization Architecture
// This service acts as the central Backend Monetization Service.
// It enforces all rules, ensuring the frontend never independently determines eligibility.

import { docClient } from "./dynamodb";

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
