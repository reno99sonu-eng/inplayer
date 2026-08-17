import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getProduct, decrementProductStock, type HammartProduct } from "@/app/lib/hammartProducts";
import { getVendorProfile } from "@/app/lib/hammartVendors";
import { createOrder } from "@/app/lib/hammartOrders";
import type { HammartOrder } from "@/app/lib/hammartOrders";
import { clampOrderQuantity, orderTotalInr, platformCommissionInr, vendorPayoutInr } from "@/app/lib/hammartOrderMath";
import { removeCartItem } from "@/app/lib/hammartCart";
import { createOrderWithTransfer } from "@/app/lib/razorpay";
import { buildUpiLink } from "@/app/lib/upi";
import { sendEmail } from "@/app/lib/ses";
import { resolveCognitoEmails } from "@/app/lib/cognitoClient";
import { sendOrderConfirmationMessage, sendVendorOrderMessage } from "@/app/lib/whatsapp";

// Hammart checkout — one order-batch per VENDOR GROUP, not per product
// line: a cart with 3 items from the same seller becomes one payment (of
// whichever kind that vendor supports), not three separate ones. Each
// product line still gets its own HammartOrder row (so vendor
// fulfillment, buyer order history, and feedback all keep working
// unchanged), but every row from the same vendor group shares one
// payment outcome.
//
// Two payment methods, chosen per vendor group, never per buyer choice —
// Reno's explicit call: a vendor is NOT required to have a Razorpay
// account to sell on Hammart.
//
//   "razorpay" — used when the vendor's Razorpay Route linked account is
//                "active". A real Razorpay Order + Route transfer is
//                created; Razorpay auto-splits the payment the instant
//                it's captured, sending the vendor their share (order
//                total minus InPlayer's flat ₹0.50 commission) and
//                leaving the commission in InPlayer's own balance. Status
//                only ever reaches "paid" via the signature-verified
//                webhook (app/api/webhooks/razorpay/route.ts) — never
//                trusted from the browser.
//
//   "upi"      — the fallback for any vendor who hasn't set up Razorpay
//                Route (or whose account isn't active yet), same model
//                Hammart used before Route existed: the buyer pays the
//                vendor's own UPI ID directly (QR code + payment link),
//                InPlayer never touches or sees that money, and the
//                vendor self-confirms once they've actually received it.
//                No platform commission is taken on this path — there's
//                no custodial step for InPlayer to deduct one from.
//
// Money-safety property this route is built around: nothing here ever
// creates a Razorpay Order (i.e. never gives the buyer anything to pay a
// gateway against) for a vendor whose Route linked account isn't fully
// "active" — those vendors fall back to the UPI path instead, or (if they
// have no UPI ID either) are blocked from checkout entirely. Either way,
// a buyer's money is never routed toward a destination that can't
// actually receive it.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];
  const buyerPhone = typeof body.buyerPhone === "string" ? body.buyerPhone.trim().slice(0, 20) : "";
  const deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim().slice(0, 300) : "";
  const city = typeof body.city === "string" ? body.city.trim().slice(0, 60) : "";
  const state = typeof body.state === "string" ? body.state.trim().slice(0, 60) : "";
  const pincode = typeof body.pincode === "string" ? body.pincode.trim().slice(0, 10) : "";
  const customName = typeof body.buyerName === "string" ? body.buyerName.trim().slice(0, 100) : "";
  const customEmail = typeof body.buyerEmail === "string" ? body.buyerEmail.trim().slice(0, 120) : "";

  if (rawItems.length === 0) {
    return NextResponse.json({ error: "Your cart has no items to check out." }, { status: 400 });
  }
  if (!deliveryAddress || !buyerPhone) {
    return NextResponse.json({ error: "Please provide your phone number and delivery address." }, { status: 400 });
  }

  const buyerName = customName || user.name || "InPlayer Customer";
  const buyerEmail = customEmail || user.email || "";

  interface ResolvedItem {
    productId: string;
    quantity: number;
    product: HammartProduct;
  }
  interface FailedItem {
    productId: string;
    productTitle: string;
    error: string;
  }

  const resolvedItems: ResolvedItem[] = [];
  const failedItems: FailedItem[] = [];

  // Never trust productId/quantity/price off the client — re-resolve
  // every line against the real product row.
  for (const raw of rawItems) {
    const productId = raw && typeof raw === "object" && typeof (raw as { productId?: unknown }).productId === "string"
      ? (raw as { productId: string }).productId
      : "";
    if (!productId) continue;
    const quantity = clampOrderQuantity((raw as { quantity?: unknown }).quantity ?? 1);

    const { product } = await getProduct(productId);
    if (!product || product.status !== "active") {
      failedItems.push({ productId, productTitle: product?.title || "Unknown item", error: "This listing is no longer available." });
      continue;
    }
    if (product.vendorUserId === user.userId) {
      failedItems.push({ productId, productTitle: product.title, error: "You can't buy your own listing." });
      continue;
    }
    if (product.stockQuantity !== undefined && quantity > product.stockQuantity) {
      failedItems.push({ productId, productTitle: product.title, error: `Only ${product.stockQuantity} available in stock.` });
      continue;
    }
    resolvedItems.push({ productId, quantity, product });
  }

  // Group by vendor — this is what becomes one payment (Razorpay Order +
  // Route transfer, or one UPI QR/link) per seller, however many products
  // from that seller are in the cart.
  const groups = new Map<string, ResolvedItem[]>();
  for (const item of resolvedItems) {
    const key = item.product.vendorUserId;
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }

  interface VendorGroupResult {
    vendorUserId: string;
    vendorId: string;
    success: boolean;
    error?: string;
    paymentMethod?: "razorpay" | "upi";
    // razorpay path
    razorpayOrderId?: string;
    razorpayKeyId?: string;
    // upi path
    upiLink?: string;
    vendorUpiId?: string;
    amountInr?: number;
    orderIds?: string[];
  }

  const groupResults: VendorGroupResult[] = [];

  for (const [vendorUserId, items] of groups) {
    const vendorIdLabel = items[0].product.vendorId;
    const { vendor } = await getVendorProfile(vendorUserId);

    if (!vendor || vendor.suspended) {
      failedItems.push(
        ...items.map((it) => ({ productId: it.productId, productTitle: it.product.title, error: "This vendor can't accept orders right now." }))
      );
      continue;
    }

    // Which payment method this vendor group actually uses — Razorpay
    // Route is preferred (real gateway verification, automatic payout,
    // ₹0.50 commission), but it's never required. A vendor with no active
    // Route account but a UPI ID on file falls back to direct UPI, same
    // as Hammart operated before Route existed. Checking razorpayAccountId
    // too, not just the status string — belt-and-suspenders against any
    // future code path that could set status to "active" without ever
    // having stored a real account id.
    const useRazorpay = vendor.razorpayAccountStatus === "active" && Boolean(vendor.razorpayAccountId);
    const useUpiFallback = !useRazorpay && Boolean(vendor.upiId);

    if (!useRazorpay && !useUpiFallback) {
      failedItems.push(
        ...items.map((it) => ({
          productId: it.productId,
          productTitle: it.product.title,
          error: "This seller hasn't finished payment setup yet — please check back soon.",
        }))
      );
      continue;
    }

    // Create every HammartOrder row for this vendor group up front.
    // Razorpay-path rows start "payment_pending" (webhook flips them to
    // "paid"/"payment_failed", with per-line commission/payout computed
    // right now — see markOrderPaid's comment on why that's never
    // reconstructed later). UPI-path rows start "placed" — same meaning
    // it's always had: the buyer says they'll pay the vendor's UPI ID
    // directly, InPlayer's server never sees that money move, and the
    // vendor self-confirms once they've actually received it. No
    // platformFeeInr/vendorPayoutInr on UPI-path rows — there's no
    // custodial step for InPlayer to deduct a commission from.
    const createdOrders: HammartOrder[] = [];
    for (const item of items) {
      const lineTotal = item.product.priceInr * item.quantity;
      const result = await createOrder({
        productId: item.product.productId,
        productTitle: item.product.title,
        productImageUrl: item.product.imageUrl,
        priceInr: item.product.priceInr,
        quantity: item.quantity,
        buyerUserId: user.userId,
        buyerName,
        buyerEmail,
        buyerPhone,
        deliveryAddress,
        city,
        state,
        pincode,
        vendorUserId: vendor.userId,
        vendorId: vendor.vendorId,
        vendorUpiId: vendor.upiId || "",
        status: useRazorpay ? "payment_pending" : "placed",
        ...(useRazorpay
          ? { platformFeeInr: platformCommissionInr(lineTotal), vendorPayoutInr: vendorPayoutInr(lineTotal) }
          : {}),
      });
      if (result.success && result.order) {
        createdOrders.push(result.order);
        await decrementProductStock(item.product.productId, item.quantity).catch(err => console.error("Failed to decrement stock:", err));
      }
    }

    if (createdOrders.length === 0) {
      failedItems.push(...items.map((it) => ({ productId: it.productId, productTitle: it.product.title, error: "Couldn't place this order right now." })));
      continue;
    }

    const groupSubtotal = createdOrders.reduce((sum, o) => sum + orderTotalInr(o), 0);
    const orderIdsDisplay = createdOrders.map((o) => o.orderId.slice(0, 8).toUpperCase()).join(", ");
    const itemLines = createdOrders.map((o) => `- ${o.productTitle} (₹${o.priceInr}${(o.quantity ?? 1) > 1 ? ` × ${o.quantity}` : ""})`).join("\n");
    const vendorEmailMap = await resolveCognitoEmails([vendor.userId]);
    const vendorEmail = vendorEmailMap.get(vendor.userId);

    if (useRazorpay) {
      const groupVendorPayout = createdOrders.reduce((sum, o) => sum + (o.vendorPayoutInr || 0), 0);

      try {
        const razorpayOrder = await createOrderWithTransfer({
          amountInr: groupSubtotal,
          vendorAccountId: vendor.razorpayAccountId as string,
          vendorPayoutInr: groupVendorPayout,
          receipt: createdOrders[0].orderId,
          notes: {
            hammartOrderIds: createdOrders.map((o) => o.orderId).join(","),
            hammartVendorId: vendor.userId,
            hammartBuyerId: user.userId,
          },
        });

        groupResults.push({
          vendorUserId: vendor.userId,
          vendorId: vendorIdLabel,
          success: true,
          paymentMethod: "razorpay",
          razorpayOrderId: razorpayOrder.id,
          razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amountInr: groupSubtotal,
          orderIds: createdOrders.map((o) => o.orderId),
        });

        // Vendor notification — sent now (order exists, payment not
        // confirmed yet) rather than waiting for the webhook, so the
        // vendor isn't left completely in the dark for however long a
        // buyer takes to actually complete Checkout. The buyer's own
        // confirmation email is deliberately NOT sent here — see the
        // webhook, which sends it only once payment is actually
        // verified, so a buyer never gets a "your order is confirmed"
        // email for something they hadn't actually paid for yet.
        if (vendorEmail) {
          void sendEmail({
            to: vendorEmail,
            subject: `🛒 New Hammart order started [${orderIdsDisplay}]`,
            text: `A buyer has started checkout for:\n${itemLines}\n\nTotal: ₹${groupSubtotal.toLocaleString("en-IN")}\n\nThis will show as "Awaiting payment" until Razorpay confirms the payment — you'll get a second email once it's actually paid.\n\nCustomer: ${buyerName} · ${buyerPhone}\nDelivery: ${[deliveryAddress, city, state, pincode].filter(Boolean).join(", ")}`,
            html: `<p>A buyer has started checkout for:</p><pre>${itemLines}</pre><p><strong>Total:</strong> ₹${groupSubtotal.toLocaleString("en-IN")}</p><p>This will show as "Awaiting payment" until Razorpay confirms the payment — you'll get a second email once it's actually paid.</p><p><strong>Customer:</strong> ${buyerName} · ${buyerPhone}<br/><strong>Delivery:</strong> ${[deliveryAddress, city, state, pincode].filter(Boolean).join(", ")}</p>`,
          }).catch((err) => console.error("Failed to email vendor of pending Hammart order:", err));
        }
      } catch (err) {
        console.error(`hammart checkout: Razorpay order creation failed for vendor ${vendor.userId}:`, err);
        groupResults.push({
          vendorUserId: vendor.userId,
          vendorId: vendorIdLabel,
          success: false,
          error: "Couldn't start payment for this seller right now. Please try again.",
        });
      }
    } else {
      // UPI fallback — one combined QR/link per vendor group (not one per
      // product), for the group's full total. InPlayer never sees or
      // touches this money, so unlike the Razorpay path there's no
      // webhook to wait for: the order sits as "placed" until the vendor
      // confirms they actually received it (app/shop/vendor/orders).
      const upiLink = buildUpiLink({
        vpa: vendor.upiId as string,
        payeeName: vendor.vendorId,
        amountInr: groupSubtotal,
        note: createdOrders.length === 1 ? createdOrders[0].productTitle : `${vendorIdLabel} order (${createdOrders.length} items)`,
      });

      groupResults.push({
        vendorUserId: vendor.userId,
        vendorId: vendorIdLabel,
        success: true,
        paymentMethod: "upi",
        upiLink,
        vendorUpiId: vendor.upiId as string,
        amountInr: groupSubtotal,
        orderIds: createdOrders.map((o) => o.orderId),
      });

      if (buyerEmail) {
        void sendEmail({
          to: buyerEmail,
          subject: `Hammart order placed [${orderIdsDisplay}] — pay ${vendorIdLabel} directly`,
          text: `Order(s): ${orderIdsDisplay}\n${itemLines}\n\nTotal: ₹${groupSubtotal.toLocaleString("en-IN")}\n\nPay this seller directly via their UPI ID: ${vendor.upiId} — InPlayer does not process this payment. Your delivery address has been sent to the vendor for fulfillment.`,
          html: `<h2>Order placed — ${orderIdsDisplay}</h2><pre>${itemLines}</pre><p><strong>Total:</strong> ₹${groupSubtotal.toLocaleString("en-IN")}</p><p>Pay this seller directly via their UPI ID: <strong>${vendor.upiId}</strong> — InPlayer does not process this payment.</p><p>Your delivery address has been sent to the vendor for fulfillment.</p>`,
        }).catch((err) => console.error("Failed to email buyer UPI order confirmation:", err));
      }

      void sendOrderConfirmationMessage(
        buyerPhone,
        buyerName,
        `₹${groupSubtotal.toLocaleString("en-IN")}`
      ).catch((err) => console.error("Failed to send WhatsApp UPI order confirmation:", err));

      if (vendorEmail) {
        void sendEmail({
          to: vendorEmail,
          subject: `🚨 New Hammart order [${orderIdsDisplay}] — pays you directly via UPI`,
          text: `A buyer has placed an order for:\n${itemLines}\n\nTotal to collect: ₹${groupSubtotal.toLocaleString("en-IN")}\n\nThe buyer will pay you directly via your UPI ID (${vendor.upiId}). Confirm this order from your Orders page only once you've actually verified the payment arrived.\n\nCustomer: ${buyerName} · ${buyerPhone}\nDelivery: ${[deliveryAddress, city, state, pincode].filter(Boolean).join(", ")}`,
          html: `<p>A buyer has placed an order for:</p><pre>${itemLines}</pre><p><strong>Total to collect:</strong> ₹${groupSubtotal.toLocaleString("en-IN")}</p><p>The buyer will pay you directly via your UPI ID (<strong>${vendor.upiId}</strong>). Confirm this order from your Orders page only once you've actually verified the payment arrived.</p><p><strong>Customer:</strong> ${buyerName} · ${buyerPhone}<br/><strong>Delivery:</strong> ${[deliveryAddress, city, state, pincode].filter(Boolean).join(", ")}</p>`,
        }).catch((err) => console.error("Failed to email vendor of new UPI Hammart order:", err));
      }

      if (vendor.whatsappNumber) {
        void sendVendorOrderMessage(
          vendor.whatsappNumber,
          vendor.vendorId,
          `Order(s) ${orderIdsDisplay}: ${createdOrders.length} item(s) (₹${groupSubtotal.toLocaleString("en-IN")}) to collect via UPI.`
        ).catch((err) => console.error(`WhatsApp vendor notification failed for UPI order ${orderIdsDisplay}:`, err));
      }
    }
  }

  // Clear successfully-ordered items from the cart regardless of whether
  // payment actually completes yet — an order row now exists to track it
  // either way, so it shouldn't linger in the cart with a stale quantity.
  const orderedProductIds = groupResults.filter((g) => g.success).flatMap((g) => resolvedItems.filter((it) => it.product.vendorUserId === g.vendorUserId).map((it) => it.productId));
  await Promise.all(orderedProductIds.map((productId) => removeCartItem(user.userId, productId).catch((err) => console.error("Failed to clear ordered item from cart:", err))));

  return NextResponse.json({
    groups: groupResults,
    failedItems,
  });
}
