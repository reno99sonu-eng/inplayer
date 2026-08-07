import { NextRequest } from "next/server";

// Real signal for "was this actually me?" — InPlayer only has one admin
// email today (see app/lib/isAdmin.ts), so knowing WHO acted tells you
// nothing new. What actually matters is WHERE the action came from: if
// the admin account's credentials ever leaked, an action from an
// unrecognized browser/OS and an unrecognized city is the tell.
//
// Everything here is derived straight from the real request — the IP
// Vercel's edge network saw, the geolocation headers Vercel attaches to
// every request based on that real IP, and the browser's own User-Agent
// string. Nothing is looked up against a third-party API and nothing is
// guessed; a field that can't be determined (e.g. running outside Vercel,
// where those geo headers don't exist) is left null and shown as
// "Unknown" rather than faked.

export function getRequestIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // First entry is the original client; anything after is intermediate
    // proxies.
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") || null;
}

// Vercel's edge network attaches these headers to every request based on
// the real connecting IP — real geolocation, not a third-party lookup this
// app has to call or pay for. They're only present when actually running
// on Vercel (production and preview deployments), so local dev honestly
// returns null instead of a fake city.
export function getRequestLocation(request: NextRequest): string | null {
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };

  const city = decode(request.headers.get("x-vercel-ip-city"));
  const region = decode(request.headers.get("x-vercel-ip-country-region"));
  const country = decode(request.headers.get("x-vercel-ip-country"));

  const parts = [city, region, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

// Lightweight, dependency-free User-Agent parse — just enough to tell
// "Chrome on Windows" from "Safari on iPhone" for a security log, not a
// full device-detection library.
export function getRequestDevice(request: NextRequest): string | null {
  const ua = request.headers.get("user-agent");
  if (!ua) return null;

  let os = "Unknown OS";
  if (/iphone/i.test(ua)) os = "iPhone";
  else if (/ipad/i.test(ua)) os = "iPad";
  else if (/android/i.test(ua)) os = "Android";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os x|macintosh/i.test(ua)) os = "Mac";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Unknown browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "Safari";

  return `${browser} on ${os}`;
}

// ISO 3166-1 alpha-2 country code derived from Vercel's edge network
// (the same real-IP geolocation that populates city/region above). Returns
// null when running outside Vercel (local dev).
export function getRequestCountry(request: NextRequest): string | null {
  return request.headers.get("x-vercel-ip-country") || null;
}
