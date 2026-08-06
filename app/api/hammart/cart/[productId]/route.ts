import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { setCartItemQuantity, removeCartItem } from "@/app/lib/hammartCart";
import { clampOrderQuantity } from "@/app/lib/hammartOrderMath";

// PATCH /api/hammart/cart/[productId] — the cart page's own quantity
// stepper sets an absolute quantity (unlike POST /api/hammart/cart, which
// adds to whatever's already there).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const quantity = clampOrderQuantity(body.quantity);
  await setCartItemQuantity(user.userId, productId, quantity);
  return NextResponse.json({ success: true, quantity });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  await removeCartItem(user.userId, productId);
  return NextResponse.json({ success: true });
}
