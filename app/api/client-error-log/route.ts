import { NextRequest, NextResponse } from "next/server";

// A crash that happens in someone's browser has no server stack trace to
// look at — it only ever shows up in that ONE person's devtools console,
// which a non-technical visitor never opens and could never relay back
// anyway. app/global-error.tsx (root layout crashes) and
// app/components/ChunkErrorRecovery.tsx (stale-deploy chunk failures) both
// best-effort POST here so the real error message/stack ends up in
// Vercel's own server logs instead — searchable the same way any other
// server-side error already is. No auth required: a signed-out visitor's
// crash is exactly as worth seeing as a signed-in one's (and is often the
// more important case, since a broken auth flow is itself a common crash
// cause), so requiring a token here would silently drop the reports this
// exists to catch.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { kind, message, stack, digest, pathname } = (body || {}) as {
      kind?: string;
      message?: string;
      stack?: string;
      digest?: string;
      pathname?: string;
    };

    console.error(
      `[client-error]${kind ? ` (${kind})` : ""} path=${pathname || "unknown"}${
        digest ? ` digest=${digest}` : ""
      }: ${message || "no message"}` + (typeof stack === "string" && stack ? `\n${stack.slice(0, 2000)}` : "")
    );
  } catch (err) {
    console.error("client-error-log: failed to parse report:", err);
  }

  // Always 200 — this is a fire-and-forget diagnostic beacon, never
  // something the caller should retry or branch on.
  return NextResponse.json({ ok: true });
}
