// Pure, dependency-free UPI deep-link builder — deliberately has NO other
// imports (no AWS SDK, nothing server-only) so it's safe to import from
// both server routes (app/lib/hammartOrders.ts) and "use client"
// components (the checkout page) without pulling server-only code into
// the browser bundle.
export function buildUpiLink(params: { vpa: string; payeeName: string; amountInr: number; note: string }): string {
  const search = new URLSearchParams({
    pa: params.vpa,
    pn: params.payeeName,
    am: params.amountInr.toFixed(2),
    cu: "INR",
    tn: params.note.slice(0, 50),
  });
  return `upi://pay?${search.toString()}`;
}
