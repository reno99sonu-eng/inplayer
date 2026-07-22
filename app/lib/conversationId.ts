// A DM conversation's id is deterministic from its two participants —
// sorted so either party can compute the same id independently, with no
// lookup table needed to find "the conversation between A and B". Cognito
// user ids (sub claims, UUIDs) never contain "_", so the separator can't
// collide with either half.
export function makeConversationId(userIdA: string, userIdB: string): string {
  const [a, b] = [userIdA, userIdB].sort();
  return `${a}_${b}`;
}

// Reverses the above: given a conversation id and my own user id, returns
// whichever half isn't me. Lets a brand-new thread (no DB row yet, since
// nobody has sent a message into it) still know who it's with.
export function otherParticipant(conversationId: string, myUserId: string): string | null {
  const [a, b] = conversationId.split("_");
  if (!a || !b) return null;
  if (a === myUserId) return b;
  if (b === myUserId) return a;
  return null;
}
