// Shared username validation/normalization — used by the live-availability
// checker, the claim endpoint, and user search, so all three can never
// enforce different rules from each other.

// 3-20 characters, must start with a letter, letters/numbers/underscores
// only. Mirrors the common "handle" convention used by most platforms.
export const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsernameFormat(raw: string): boolean {
  return USERNAME_PATTERN.test(raw.trim());
}

// Reserved so nobody can register a handle that impersonates an official
// InPlayer account or a system route. Mirrors the real addresses listed in
// the navbar's Contact panel (see CONTACT_EMAILS in app/components/Navbar.tsx)
// plus a handful of obvious system words.
export const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "help",
  "contact",
  "business",
  "partners",
  "corporate",
  "copyright",
  "ads",
  "team",
  "inplayer",
  "official",
  "moderator",
  "null",
  "undefined",
  "api",
  "settings",
  "profile",
  "messages",
  "notifications",
  "upload",
  "watch",
  "videos",
];

export function isReservedUsername(lower: string): boolean {
  return RESERVED_USERNAMES.includes(lower);
}
