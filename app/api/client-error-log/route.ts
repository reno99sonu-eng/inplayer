import { NextRequest, NextResponse } from "next/server";
import { createErrorLog } from "@/app/lib/errorLogs";

// A crash that happens in someone's browser has no server stack trace to
// look at — it only ever shows up in that ONE person's devtools console,
// which a non-technical visitor never opens and could never relay back
// anyway. app/global-error.tsx (root layout crashes) and
// app/components/ChunkErrorRecovery.tsx (stale-deploy chunk failures) both
// best-effort POST here. No auth required: a signed-out visitor's crash is
// exactly as worth seeing as a signed-in one's (and is often the more
// important case, since a broken auth flow is itself a common crash
// cause), so requiring a token here would silently drop the reports this
// exists to catch.
//
// Persisted to DynamoDB (see app/lib/errorLogs.ts) so these show up in
// Admin Panel > Error Logs where Reno can actually see them himself,
// instead of only ever existing in Vercel's own server console — this
// used to be console.error-only, which meant every crash found and fixed
// while debugging the site left no trace anywhere Reno could look back at.
// Still ALSO console.error'd below, unchanged, so anything already relying
// on that (like watching live Vercel logs during an active investigation)
// keeps working exactly as before.
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

    // Best-effort — createErrorLog already fails open (returns rather than
    // throws if the table doesn't exist yet), and this whole handler always
    // returns 200 regardless, so a DynamoDB hiccup here can never turn this
    // fire-and-forget diagnostic beacon into a second point of failure.
    await createErrorLog({
      kind: typeof kind === "string" && kind ? kind : "unknown",
      message: typeof message === "string" && message ? message : "no message",
      stack: typeof stack === "string" && stack ? stack.slice(0, 4000) : null,
      digest: typeof digest === "string" && digest ? digest : null,
      pathname: typeof pathname === "string" && pathname ? pathname : "unknown",
      userAgent: request.headers.get("user-agent"),
    });
  } catch (err) {
    console.error("client-error-log: failed to parse report:", err);
  }

  // Always 200 — this is a fire-and-forget diagnostic beacon, never
  // something the caller should retry or branch on.
  return NextResponse.json({ ok: true });
}
