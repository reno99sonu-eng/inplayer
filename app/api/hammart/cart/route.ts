import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { listCartItems, addToCart } from "@/app/lib/hammartCart";
import { clampOrderQuantity } from "@/app/lib/hammartOrderMath";
import { getProduct } from "@/app/lib/hammartProducts";

// GET /api/hammart/cart — the signed-in buyer's own cart, live-joined
// against the real product record for every line. A cart must always
// reflect the vendor's current real price and availability, never a
// stale snapshot — see app/lib/hammartCart.ts's top comment.
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { items, tableMissing } = await listCartItems(user.userId);
  if (tableMissing) return NextResponse.json({ items: [], tableMissing: true });

  const enriched = await Promise.all(
    items.map(async (item) => {
      const { product } = await getProduct(item.productId);
      const available = Boolean(product && product.status === "active");
      return {
        productId: item.productId,
        quantity: item.quantity,
        addedAt: item.addedAt,
        product: available ? product : null,
        unavailable: !available,
      };
    })
  );
  enriched.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

  return NextResponse.json({ items: enriched });
}

// POST /api/hammart/cart — add a product to the cart. Adds to whatever
// quantity is already there rather than replacing it, matching a normal
// "Add to Cart" button (see hammartCart.ts's addToCart).
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === "string" ? body.productId : "";
  if (!productId) return NextResponse.json({ error: "productId is required." }, { status: 400 });

  const { product } = await getProduct(productId);
  if (!product || product.status !== "active") {
    return NextResponse.json({ error: "This listing is no longer available." }, { status: 404 });
  }
  if (product.vendorUserId === user.userId) {
    return NextResponse.json({ error: "You can't add your own listing to your cart." }, { status: 400 });
  }

  const quantityToAdd = clampOrderQuantity(body.quantity ?? 1);
  const { quantity } = await addToCart(user.userId, productId, quantityToAdd);

  return NextResponse.json({ success: true, quantity });
}
