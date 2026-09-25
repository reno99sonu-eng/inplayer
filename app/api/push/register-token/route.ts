import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { registerPushToken, unregisterPushToken } from "@/app/lib/push";

// Called by the Android app once signed in (see PushNotificationService.
// registerToken()) with its current FCM device token, and again on sign-out
// to remove it (unregisterToken()).
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const platform = typeof body?.platform === "string" ? body.platform : "android";
  if (!token) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  await registerPushToken(user.userId, token, platform);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  await unregisterPushToken(user.userId, token);
  return NextResponse.json({ success: true });
}
