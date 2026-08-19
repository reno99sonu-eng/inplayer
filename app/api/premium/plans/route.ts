import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import {
  FREE_BENEFITS,
  PREMIUM_BENEFITS,
  PREMIUM_PLAN_LIST,
  publicPlan,
} from "@/app/lib/premiumPlans";

// What InPlayer Premium is, and (only if you're signed in) what it costs.
//
//   signed out  ->  plan names, cadence, badges, and the full benefit list.
//   signed in   ->  the same, plus amountInr for the checkout step.
//
// Answering signed-out is the point: Reno's rule is that anyone can see
// what Premium gives them before committing, and the price appears when
// they actually go to buy. Identical treatment to the sponsorship packages
// endpoint.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let signedIn = false;
  try {
    await verifyAuth(request);
    signedIn = true;
  } catch {
    // Anonymous visitor - benefits only, no figures.
  }

  return NextResponse.json({
    plans: PREMIUM_PLAN_LIST.map((plan) => (signedIn ? plan : publicPlan(plan))),
    premiumBenefits: PREMIUM_BENEFITS,
    freeBenefits: FREE_BENEFITS,
  });
}
