/**
 * WhatsApp Meta Cloud API Integration
 */

function formatPhoneNumber(phone: string): string {
  // Strip all non-numeric characters
  let cleaned = phone.replace(/\D/g, "");
  // Default to India country code if length is 10
  if (cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }
  return cleaned;
}

export async function sendWhatsAppMessage(
  toPhone: string,
  templateName: string,
  // Meta's Message Templates dashboard shows "order_confirmation" and
  // "vendor_order_notification" under Language = plain "English", which is
  // the `en` code — NOT `en_US` ("English (US)"), which is a different
  // language variant to Meta's API and will 132001-fail to match. Confirmed
  // directly against the live WhatsApp Manager template list on 18 Aug 2026.
  languageCode: string = "en",
  components: any[] = []
): Promise<boolean> {
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.warn("[WhatsApp Setup Missing] Would have sent template:", templateName, "to", toPhone, "with args:", components);
    // Simulate success if keys are missing so the checkout flow isn't blocked during development
    return true;
  }

  const payload = {
    messaging_product: "whatsapp",
    to: formatPhoneNumber(toPhone),
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components: components,
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("WhatsApp API Error:", err);
      return false;
    }
    return true;
  } catch (error) {
    console.error("WhatsApp Request Failed:", error);
    return false;
  }
}

export async function sendOtpMessage(phone: string, otp: string): Promise<boolean> {
  // NOTE: "otp_verification" wasn't visible in the confirmed screenshots
  // (it may be under WhatsApp Manager's collapsed "See more" template row) —
  // its language wasn't verified. Left as en_US; if OTP sends start failing
  // with error 132001, check this template's Language column the same way
  // order_confirmation/vendor_order_notification were confirmed, and change
  // this one call to "en" if it also shows plain "English".
  return await sendWhatsAppMessage(phone, "otp_verification", "en_US", [
    {
      type: "body",
      parameters: [
        { type: "text", text: otp }
      ]
    },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        { type: "text", text: otp }
      ]
    }
  ]);
}

export async function sendOrderConfirmationMessage(phone: string, buyerName: string, amount: string): Promise<boolean> {
  return await sendWhatsAppMessage(phone, "order_confirmation", "en", [
    {
      type: "body",
      parameters: [
        { type: "text", text: buyerName },
        { type: "text", text: amount }
      ]
    }
  ]);
}

export async function sendVendorOrderMessage(phone: string, vendorName: string, orderDetails: string): Promise<boolean> {
  return await sendWhatsAppMessage(phone, "vendor_order_notification", "en", [
    {
      type: "body",
      parameters: [
        { type: "text", text: vendorName },
        { type: "text", text: orderDetails }
      ]
    }
  ]);
}
