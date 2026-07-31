import { PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";

// Real bug/error report pipeline — a signed-in user hits a problem
// anywhere on InPlayer, tells us what happened (optionally with a
// screenshot), and it lands here for the admin team to triage. Same
// tableMissing convention as everywhere else — Reno creates this table by
// hand in AWS.
export const BUG_REPORTS_TABLE = "InPlayer-Bug-Reports"; // PK: reportId

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
  try {
    await docClient.send(
      new PutCommand({
        TableName: BUG_REPORTS_TABLE,
        Item: {
          ...input,
          reportId: randomUUID(),
          status: "open",
          adminNotes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    );
    return { success: true };
  } catch (err) {
    console.error("createBugReport: write failed (table may not exist yet):", err);
    return { success: false, tableMissing: true };
  }
}

export async function listBugReports(status?: BugReportStatus): Promise<{ reports: BugReport[]; tableMissing: boolean }> {
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
  } catch (err) {
    console.error("listBugReports: scan failed (table may not exist yet):", err);
    return { reports: [], tableMissing: true };
  }
}

export async function updateBugReportStatus(reportId: string, status: BugReportStatus, adminNotes?: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: BUG_REPORTS_TABLE,
      Key: { reportId },
      UpdateExpression: "SET #status = :status, adminNotes = :notes, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status, ":notes": adminNotes ?? null, ":now": new Date().toISOString() },
    })
  );
}