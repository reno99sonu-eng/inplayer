import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { listErrorLogs, deleteErrorLog, clearErrorLogs } from "@/app/lib/errorLogs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { logs, tableMissing } = await listErrorLogs();
  return NextResponse.json({ logs, tableMissing });
}

// DELETE /api/admin/error-logs            -> clears every logged entry
// DELETE /api/admin/error-logs?id=<errorId> -> deletes just that one entry
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errorId = request.nextUrl.searchParams.get("id");
  if (errorId) {
    await deleteErrorLog(errorId);
  } else {
    await clearErrorLogs();
  }
  return NextResponse.json({ success: true });
}
