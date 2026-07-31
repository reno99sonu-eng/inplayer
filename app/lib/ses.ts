import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Real outbound email via Amazon SES — same AWS account already used for
// DynamoDB and Cognito, just a different service, so the existing
// AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY credentials are reused (that IAM
// user/role needs ses:SendEmail permission added — a real manual step in
// AWS IAM, same category as creating a DynamoDB table by hand).
//
// Reno needs to do two things in the AWS Console before this can actually
// send anything: (1) verify a sending identity (a domain or single email
// address) in SES — Simple Email Service -> Verified identities -> Create
// identity, and (2) request production access if the account is still in
// the SES sandbox (sandbox mode can only email verified recipient
// addresses, which would silently block real vendor notifications). Set
// SES_FROM_EMAIL to the verified address/domain once done.
let client: SESClient | null = null;

function getSesClient(): SESClient {
  if (!client) {
    client = new SESClient({
      region: process.env.AWS_REGION || "ap-south-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return client;
}

// Fire-and-forget by design at every call site (same convention as
// app/lib/notifications.ts and app/lib/auditLog.ts) — a failed email must
// never block or fail the real action (an order being placed, a listing
// going live). Callers log the failure and move on.
export async function sendEmail(params: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const fromEmail = process.env.SES_FROM_EMAIL;
  if (!fromEmail) {
    console.error("sendEmail: SES_FROM_EMAIL is not set — email not sent. Set it once a sending identity is verified in SES.");
    return false;
  }

  try {
    await getSesClient().send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [params.to] },
        Message: {
          Subject: { Data: params.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: params.html, Charset: "UTF-8" },
            Text: { Data: params.text, Charset: "UTF-8" },
          },
        },
      })
    );
    return true;
  } catch (err) {
    console.error(`sendEmail: SES send failed for ${params.to}:`, err);
    return false;
  }
}
