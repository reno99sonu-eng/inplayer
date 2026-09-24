import { NextRequest, NextResponse } from "next/server";
import { validateInvitation } from "@/app/lib/adminInvitations";
import { emailHasCognitoAccount } from "@/app/lib/cognitoClient";

// Deliberately unauthenticated — this is what lets app/team/accept/page.tsx
// know whether to auto-open the sign-in or sign-up modal BEFORE the
// invitee has signed in at all (that's the whole point of this endpoint).
// Safe because it requires the invitation's own (id, token) pair, exactly
// like accepting it does — validateInvitation is the same check
// app/api/admin/team/accept uses, just without an expectedEmail since
// there's no signed-in user yet. Only ever reveals whether THAT ONE
// specific, already-invited email has an account — never an arbitrary
// email an attacker supplies, and never anything about the account itself
// beyond that one boolean.
export async function GET(request: NextRequest) {
  const invitationId = request.nextUrl.searchParams.get("id") || "";
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!invitationId || !token) {
    return NextResponse.json({ error: "Invalid invitation link." }, { status: 400 });
  }

  const validation = await validateInvitation(invitationId, token);
  if (!validation.ok) {
    const messages: Record<string, string> = {
      not_found: "This invitation doesn't exist.",
      bad_token: "Invalid invitation link.",
      expired: "This invitation has expired. Ask the main admin to send a new one.",
      already_used: "This invitation has already been used or revoked.",
      email_mismatch: "This invitation is no longer valid.",
    };
    return NextResponse.json(
      { error: messages[validation.error] || "This invitation is no longer valid." },
      { status: 400 }
    );
  }

  const hasAccount = await emailHasCognitoAccount(validation.invitation.email);
  return NextResponse.json({ email: validation.invitation.email, hasAccount });
}
