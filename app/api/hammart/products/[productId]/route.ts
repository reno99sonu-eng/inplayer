import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getProduct, setProductStatus, deleteProduct } from "@/app/lib/hammartProducts";

export async function GET(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const { product, tableMissing } = await getProduct(productId);
  if (!product) {
    return NextResponse.json({ error: "Listing not found.", tableMissing }, { status: 404 });
  }

  if (product.status !== "active") {
    // Non-active listings are only visible to their own vendor.
    let userId: string | null = null;
    try {
      userId = (await verifyAuth(request)).userId;
    } catch {
      /* not signed in — treat as not found below */
    }
    if (userId !== product.vendorUserId) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }
  }

  return NextResponse.json({ product });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { product } = await getProduct(productId);
  if (!product) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  if (product.vendorUserId !== user.userId) {
    return NextResponse.json({ error: "You don't own this listing." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.status !== "active" && body.status !== "vendor_hidden") {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (body.status === "active" && product.flagged) {
    return NextResponse.json({ error: "This listing was flagged and can't be republished — contact InPlayer support." }, { status: 403 });
  }

  await setProductStatus(productId, body.status);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { product } = await getProduct(productId);
  if (!product) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  if (product.vendorUserId !== user.userId) {
    return NextResponse.json({ error: "You don't own this listing." }, { status: 403 });
  }

  await deleteProduct(productId);
  return NextResponse.json({ success: true });
}
