import { PutCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";

// Automatic crash/error log pipeline — every real crash caught by
// app/global-error.tsx (root layout errors) or
// app/components/ChunkErrorRecovery.tsx (stale-deploy chunk failures)
// lands here via app/api/client-error-log/route.ts, so Reno can see it
// himself in Admin Panel > Error Logs instead of it only ever existing in
// Vercel's own server console. This is deliberately a SEPARATE table from
// InPlayer-Bug-Reports (app/lib/bugReports.ts) — that one is
// user-submitted "something's wrong, here's a screenshot" reports from
// Settings > Report a Problem; this one is automatic, no-user-involved
// crash telemetry with a different shape (stack traces, not screenshots).
// Same tableMissing convention as everywhere else — Reno creates this
// table by hand in AWS (see the amber banner on the admin page for the
// exact name/key to use).
export const ERROR_LOGS_TABLE = "InPlayer-Error-Logs"; // PK: errorId

export interface ErrorLogEntry {
  errorId: string;
  kind: string; // "global-error" | "chunk-error" | "unknown"
  message: string;
  stack: string | null;
  digest: string | null;
  pathname: string;
  userAgent: string | null;
  createdAt: string;
}

export async function createErrorLog(
  input: Omit<ErrorLogEntry, "errorId" | "createdAt">
): Promise<{ success: boolean; tableMissing?: boolean }> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: ERROR_LOGS_TABLE,
        Item: {
          ...input,
          errorId: randomUUID(),
          createdAt: new Date().toISOString(),
        },
      })
    );
    return { success: true };
  } catch (err) {
    console.error("createErrorLog: write failed (table may not exist yet):", err);
    return { success: false, tableMissing: true };
  }
}

export async function listErrorLogs(): Promise<{ logs: ErrorLogEntry[]; tableMissing: boolean }> {
  try {
    const items: ErrorLogEntry[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: ERROR_LOGS_TABLE,
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      items.push(...((result.Items || []) as ErrorLogEntry[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    // Cap what a single admin page load pulls back — this is a diagnostic
    // stream, not something anyone needs to page through thousands of
    // rows of at once. The table itself keeps everything; this just
    // bounds one request's payload.
    return { logs: items.slice(0, 500), tableMissing: false };
  } catch (err) {
    console.error("listErrorLogs: scan failed (table may not exist yet):", err);
    return { logs: [], tableMissing: true };
  }
}

export async function deleteErrorLog(errorId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({ TableName: ERROR_LOGS_TABLE, Key: { errorId } })
  );
}

export async function clearErrorLogs(): Promise<void> {
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: ERROR_LOGS_TABLE,
        ProjectionExpression: "errorId",
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    const items = (result.Items || []) as { errorId: string }[];
    for (const item of items) {
      await docClient.send(
        new DeleteCommand({ TableName: ERROR_LOGS_TABLE, Key: { errorId: item.errorId } })
      );
    }
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
}
