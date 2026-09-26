// Centralized Policy Versioning and Consent Validation
//
// Defines the active legal policy version across InPlayer.
// Policy Version: 2026-09-05
// Effective Date: September 5, 2026
//
// Crucial Rule: The policy version/date is NOT the same thing as the user's
// acceptance timestamp. termsAcceptedAt contains the ACTUAL timestamp when the
// individual user accepts the policy.
//
// A user is considered to have accepted the current policy if:
// 1. Their profile explicitly records termsPolicyVersion === CURRENT_POLICY_VERSION, or
// 2. Their termsAcceptedAt timestamp is on or after the POLICY_EFFECTIVE_DATE.
//
// Existing users with older timestamps (or null) evaluate to false and are
// prompted to review and accept the updated terms.

export const CURRENT_POLICY_VERSION = "2026-09-05";
export const POLICY_EFFECTIVE_DATE = "2026-09-05T00:00:00.000Z";

export function isCurrentPolicyAccepted(
  termsAcceptedAt?: string | null,
  termsPolicyVersion?: string | null
): boolean {
  if (termsPolicyVersion === CURRENT_POLICY_VERSION) {
    return true;
  }
  if (!termsAcceptedAt) {
    return false;
  }
  try {
    const acceptedTime = new Date(termsAcceptedAt).getTime();
    const effectiveTime = new Date(POLICY_EFFECTIVE_DATE).getTime();
    return !isNaN(acceptedTime) && acceptedTime >= effectiveTime;
  } catch {
    return false;
  }
}
