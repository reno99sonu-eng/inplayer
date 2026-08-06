import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { listWishlistItems, addToWishlist, WISHLIST_TABLE } from "@/app/lib/hammartWishlist";
import { getProduct } from "@/app/lib/hammartProducts";

// GET /api/hammart/wishlist — same dual-mode shape as /api/watchlist:
// with a productId query param, a cheap single-item "is this saved?"
// check for the heart button on the product page; with no param, the
// buyer's full wishlist, live-joined against the real product record so
// a saved item never shows a stale price (see hammartWishlist.ts).
export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");

  if (productId) {
    let wishlisted = false;
    try {
      const user = await verifyAuth(request);
      const existing = await docClient.send(
        new GetCommand({ TableName: WISHLIST_TABLE, Key: { userId: user.userId, productId } })
      );
      wishlisted = !!existing.Item;
    } catch {
      /* not signed in — fine, just report as not saved */
    }
    return NextResponse.json({ wishlisted });
  }

  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { items, tableMissing } = await listWishlistItems(user.userId);
  if (tableMissing) return NextResponse.json({ items: [], tableMissing: true });

  const enriched = await Promise.all(
    items.map(async (item) => {
      const { product } = await getProduct(item.productId);
      const available = Boolean(product && product.status === "active");
      return {
        productId: item.productId,
        addedAt: item.addedAt,
        product: available ? product : null,
        unavailable: !available,
      };
    })
  );
  enriched.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

  return NextResponse.json({ items: enriched });
}

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

  await addToWishlist(user.userId, productId);
  return NextResponse.json({ success: true });
}
