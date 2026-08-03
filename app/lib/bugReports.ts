import { PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { PLATFORM_SETTINGS_TABLE } from "@/app/lib/platformSettings";

export const BUG_REPORTS_TABLE = "InPlayer-Bug-Reports"; // Primary table if created in AWS

export type BugReportStatus = "open" | "in_progress" | "resolved";

export interface BugReport {
  reportId: string;
  reporterId: string;
  reporterEmail: string;
  description: string;
  pageUrl: string;
  userAgent: string;
  screenshotDataUrl: string | null;
  status: BugReportStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function createBugReport(
  input: Omit<BugReport, "reportId" | "status" | "adminNotes" | "createdAt" | "updatedAt">
): Promise<{ success: boolean; tableMissing?: boolean }> {
  const reportId = randomUUID();
  const now = new Date().toISOString();
  const reportItem: BugReport = {
    ...input,
    reportId,
    status: "open",
    adminNotes: null,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Try primary InPlayer-Bug-Reports table
  try {
    await docClient.send(
      new PutCommand({
        TableName: BUG_REPORTS_TABLE,
        Item: reportItem,
      })
    );
    return { success: true };
  } catch (err) {
    console.warn("createBugReport: InPlayer-Bug-Reports table missing, falling back to InPlayer-Platform-Settings:", err);
  }

  // 2. Fallback to existing InPlayer-Platform-Settings table (zero-setup requirement)
  try {
    await docClient.send(
      new PutCommand({
        TableName: PLATFORM_SETTINGS_TABLE,
        Item: {
          settingsId: `bug_report_${reportId}`,
          type: "bug_report",
          ...reportItem,
        },
      })
    );
    return { success: true };
  } catch (fallbackErr) {
    console.error("createBugReport: fallback write to InPlayer-Platform-Settings failed:", fallbackErr);
    return { success: false, tableMissing: true };
  }
}

export async function listBugReports(status?: BugReportStatus): Promise<{ reports: BugReport[]; tableMissing: boolean }> {
  // 1. Try primary InPlayer-Bug-Reports table
  try {
    const items: BugReport[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: BUG_REPORTS_TABLE,
          FilterExpression: status ? "#status = :status" : undefined,
          ExpressionAttributeNames: status ? { "#status": "status" } : undefined,
          ExpressionAttributeValues: status ? { ":status": status } : undefined,
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      items.push(...((result.Items || []) as BugReport[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { reports: items, tableMissing: false };
  } catch {
    // Primary table missing — attempt fallback below
  }

  // 2. Fallback scan on InPlayer-Platform-Settings table
  try {
    const items: BugReport[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: PLATFORM_SETTINGS_TABLE,
          FilterExpression: "begins_with(settingsId, :prefix)",
          ExpressionAttributeValues: { ":prefix": "bug_report_" },
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      if (result.Items) {
        for (const raw of result.Items) {
          const r: BugReport = {
            reportId: raw.reportId,
            reporterId: raw.reporterId,
            reporterEmail: raw.reporterEmail || "",
            description: raw.description || "",
            pageUrl: raw.pageUrl || "",
            userAgent: raw.userAgent || "",
            screenshotDataUrl: raw.screenshotDataUrl || null,
            status: raw.status || "open",
            adminNotes: raw.adminNotes || null,
            createdAt: raw.createdAt || new Date().toISOString(),
            updatedAt: raw.updatedAt || new Date().toISOString(),
          };
          if (!status || r.status === status) {
            items.push(r);
          }
        }
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { reports: items, tableMissing: false };
  } catch (fallbackErr) {
    console.error("listBugReports: fallback scan failed:", fallbackErr);
    return { reports: [], tableMissing: true };
  }
}

export async function updateBugReportStatus(reportId: string, status: BugReportStatus, adminNotes?: string): Promise<void> {
  const now = new Date().toISOString();
  // 1. Try primary table
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: BUG_REPORTS_TABLE,
        Key: { reportId },
        UpdateExpression: "SET #status = :status, adminNotes = :notes, updatedAt = :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": status, ":notes": adminNotes ?? null, ":now": now },
      })
    );
    return;
  } catch {
    // Primary table missing — fallback
  }

  // 2. Fallback to InPlayer-Platform-Settings
  await docClient.send(
    new UpdateCommand({
      TableName: PLATFORM_SETTINGS_TABLE,
      Key: { settingsId: `bug_report_${reportId}` },
      UpdateExpression: "SET #status = :status, adminNotes = :notes, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status, ":notes": adminNotes ?? null, ":now": now },
    })
  );
}