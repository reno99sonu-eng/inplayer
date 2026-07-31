import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { createBugReport } from "@/app/lib/bugReports";
import { THUMBNAIL_DATA_URL_MAX_LENGTH } from "@/app/lib/imageCompress";

const MAX_SCREENSHOT_LENGTH = THUMBNAIL_DATA_URL_MAX_LENGTH * 2;

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
  const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.slice(0, 500) : "";
  const userAgent = typeof body.userAgent === "string" ? body.userAgent.slice(0, 500) : "";
  const screenshotDataUrl = typeof body.screenshotDataUrl === "string" ? body.screenshotDataUrl : null;

  if (!description) {
    return NextResponse.json({ error: "Please describe what happened." }, { status: 400 });
  }
  if (screenshotDataUrl && (!screenshotDataUrl.startsWith("data:image/") || screenshotDataUrl.length > MAX_SCREENSHOT_LENGTH)) {
    return NextResponse.json({ error: "Please attach a valid screenshot." }, { status: 400 });
  }

  const result = await createBugReport({
    reporterId: user.userId,
    reporterEmail: user.email || "",
    description,
    pageUrl,
    userAgent,
    screenshotDataUrl,
  });

  if (!result.success) {
    return NextResponse.json({ error: "Couldn't submit your report right now.", tableMissing: result.tableMissing }, { status: 503 });
  }

  return NextResponse.json({ success: true });
}
