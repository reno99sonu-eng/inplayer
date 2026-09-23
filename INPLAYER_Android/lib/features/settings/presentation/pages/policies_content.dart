/// The full canonical text of InPlayer's three policy documents, mirrored
/// verbatim (in substance) from the website's single source of truth:
/// app/components/policies/sections/{PrivacyPolicySection,TermsSection,
/// VendorTermsSection}.tsx. Previously this app carried its own much
/// shorter, out-of-sync paraphrase of each policy inline in app_router.dart
/// — this file replaces that with the same content the website shows, so
/// there is effectively one source of truth read into two renderers
/// instead of two independently-drifting copies.
class PolicySectionData {
  final String title;
  final String body;

  const PolicySectionData(this.title, this.body);
}

class PolicyDocData {
  final String title;
  final String lastUpdated;
  final String intro;
  final List<PolicySectionData> sections;

  const PolicyDocData({
    required this.title,
    required this.lastUpdated,
    required this.intro,
    required this.sections,
  });
}

const privacyPolicyDoc = PolicyDocData(
  title: 'Privacy Policy',
  lastUpdated: '4 August 2026',
  intro:
      "This explains what information InPlayer collects, why, and what control you have over it.",
  sections: [
    PolicySectionData(
      '1. What we collect',
      '• Account info: your email, name, and age (used only to confirm you\'re 13+) when you sign up.\n'
          '• Profile info: anything you choose to add — avatar, cover photo, username, bio, social links.\n'
          '• Content: the videos, Shorts, comments, and direct messages you post.\n'
          '• Activity: what you watch, like, subscribe to, and search for, so we can show you relevant recommendations and let you access your own watch history.\n'
          '• Technical info: basic device and usage data (like error logs) used to keep the service running.\n'
          '• Payment info: if you subscribe to InPlayer Premium or a HamMart vendor plan, or buy a HamMart product, your payment details are collected and processed directly by Razorpay — see "Who we share data with" below. InPlayer never sees or stores your card, UPI, or bank details itself.\n'
          '• HamMart vendor info: if you register as a HamMart vendor, we collect the business details and identity/KYC documents (such as a PAN or Aadhaar-based ID) required to verify you as a seller, plus your product listings and order history.',
    ),
    PolicySectionData(
      '2. How we use it',
      '• To run your account and let you use InPlayer\'s features\n'
          '• To recommend videos and Shorts you might like\n'
          '• To automatically scan new comments, messages, and upload titles/descriptions for policy violations (see "Automated moderation" below)\n'
          '• To respond to support requests and enforce our Terms of Service\n'
          '• To improve InPlayer\'s features and fix problems\n\n'
          'We do not sell your personal information.',
    ),
    PolicySectionData(
      '3. Automated moderation',
      'When you post a comment, send a direct message, or upload a video/Short, the text is automatically checked against a third-party content moderation service (OpenAI\'s Moderation API) for likely policy violations — hate speech, harassment, violence, sexual content, and similar categories. Only the text itself is sent for this check; nothing else about your account is shared with that service. Content flagged as a likely violation is hidden immediately, pending review by an InPlayer admin.',
    ),
    PolicySectionData(
      '4. Who we share data with',
      'We use a small number of service providers to run InPlayer, each only for its purpose:\n\n'
          '• Amazon Web Services (AWS) — hosts our database and authentication (sign-in).\n'
          '• Mux — hosts and streams video/Short files.\n'
          '• OpenAI — the automated moderation check described above, and (separately) AI-assisted creative tools like thumbnail generation, which you trigger yourself.\n'
          '• Google — if you choose "Continue with Google" to sign in.\n'
          '• Vercel — hosts the InPlayer website itself.\n'
          '• Razorpay — processes payments for Premium subscriptions, HamMart vendor plans, and HamMart product purchases. Razorpay receives your payment details directly (card/UPI/bank info); InPlayer only receives confirmation that a payment succeeded, not the underlying payment details.\n'
          '• Amazon SES — sends account emails (verification codes, notifications) on our behalf.\n\n'
          'If you buy a product on HamMart, the vendor you bought from also receives what they need to fulfil your order (such as your shipping details and order contents) — see "Buying and selling on HamMart" in the Terms of Service tab.',
    ),
    PolicySectionData(
      '5. Cookies & Third-Party Advertising (Google AdSense)',
      'We and our third-party advertising partners (such as Google and Google AdSense) use cookies, web beacons, and similar technologies to serve advertisements on InPlayer.\n\n'
          '• Third-party vendors, including Google, use cookies to serve ads based on a user\'s prior visits to our website or other websites on the Internet.\n'
          '• Google\'s use of advertising cookies enables it and its partners to serve ads to our users based on their visits to InPlayer and/or other sites across the web.\n'
          '• Users may opt out of personalized advertising by visiting Google Ads Settings (google.com/settings/ads). Alternatively, you can opt out of third-party vendor use of cookies for personalized advertising by visiting aboutads.info/choices.',
    ),
    PolicySectionData(
      '6. Your choices',
      '• Edit or remove content: delete your own videos, Shorts, comments, and messages any time.\n'
          '• Privacy settings: control who sees your username and profile from Settings → Account & Privacy.\n'
          '• Delete your account: permanently delete your account and profile from Settings at any time. This can\'t be undone.',
    ),
    PolicySectionData(
      '7. Children\'s privacy',
      'InPlayer requires all accounts to be 13 or older, and if you\'re under 18 we ask you to confirm you have your parent or guardian\'s permission at signup. India\'s Digital Personal Data Protection Act, 2023 defines a "child" as anyone under 18 and calls for verifiable parental consent before processing a child\'s data — our current under-18 signup flow is a self-declared confirmation, not yet a verified parental-consent flow. We\'re working towards full compliance as that law\'s rules come into effect. We don\'t knowingly collect data from anyone under 13, don\'t show targeted ads to any account that\'s declared itself under 18, and don\'t build ad-targeting profiles of minors. If you believe a child under 13 has created an account, or that a minor\'s account needs attention, contact contact@inplayer.in and we\'ll act on it.',
    ),
    PolicySectionData(
      '8. Your rights & grievance officer',
      'Under India\'s Digital Personal Data Protection Act, 2023, you can ask us to: tell you what personal data we hold about you, correct it if it\'s wrong or incomplete, or erase it (subject to what we\'re legally required to keep, like security logs). Email support@inplayer.in to make any of these requests — we aim to respond within 30 days and, at most, 90 days.\n\n'
          'For complaints about how we handle your data, contact our Grievance Officer — the same contact listed in the Terms of Service tab. If a data breach affects your account, we\'ll notify you without undue delay.\n\n'
          'We keep your data only as long as your account is active or as needed for the purposes above; when you delete your account, we delete your personal data except where the law requires us to retain certain records (such as security/audit logs) for a limited time.',
    ),
    PolicySectionData(
      '9. Changes to this policy',
      'If we make a material change to how we handle your data, we\'ll update the "Last updated" date above.',
    ),
    PolicySectionData(
      '10. Contact',
      'Questions about your data? Email contact@inplayer.in.',
    ),
  ],
);

const termsOfServiceDoc = PolicyDocData(
  title: 'Terms of Service',
  lastUpdated: '4 August 2026',
  intro:
      'These Terms govern your use of InPlayer (inplayer.in), including our website, mobile experience, video and Shorts hosting, comments, and direct messaging. By creating an account or using InPlayer, you agree to these Terms.',
  sections: [
    PolicySectionData(
      '1. Who can use InPlayer',
      'You must be at least 13 years old to create an InPlayer account. If you are under 18, you confirm you have your parent or guardian\'s permission to use InPlayer. We ask for your age at signup to enforce this.',
    ),
    PolicySectionData(
      '2. Your account',
      'You\'re responsible for keeping your password secure and for everything that happens under your account. Tell us right away at support@inplayer.in if you believe your account has been compromised.\n\n'
          'You can permanently delete your account at any time from Settings. This removes your profile and cannot be undone — see the Privacy Policy tab for exactly what happens to your data when you do.',
    ),
    PolicySectionData(
      '3. Content you post',
      'You keep ownership of the videos, Shorts, comments, and messages you post. By posting on InPlayer, you give us a license to host, store, display, and distribute that content on InPlayer so other users can view it — nothing more. You\'re responsible for having the rights to anything you upload.\n\n'
          'You agree not to post content that:\n'
          '• Infringes someone else\'s copyright, trademark, or other rights\n'
          '• Contains hate speech, harassment, or threats of violence\n'
          '• Sexually exploits or endangers a minor, in any form\n'
          '• Is sexually explicit, or shows someone in an intimate act or state of undress without their consent\n'
          '• Impersonates another person or organization, or misrepresents your identity or affiliation\n'
          '• Invades another person\'s privacy, including sharing someone\'s private information without their consent\n'
          '• Is patently false or misleading in a way likely to cause public harm or panic\n'
          '• Threatens India\'s sovereignty, integrity, security, or friendly relations with other countries, or incites an offence relating to any of these\n'
          '• Is spam, scam, or deliberately misleading\n'
          '• Violates any applicable law\n\n'
          'This list reflects the categories of content Indian law (the IT Rules, 2021) requires platforms like InPlayer to prohibit — see "Grievance Officer" below for how to report content that violates it.\n\n'
          'To help enforce this, InPlayer automatically scans new comments, direct messages, and upload titles/descriptions for likely policy violations at the moment they\'re posted, and holds back anything flagged until a human reviews it. Any user can also report content directly (the Report option under videos, comments, and messages) — see the Privacy Policy tab for how that moderation works.',
    ),
    PolicySectionData(
      '4. Copyright (DMCA-style takedowns)',
      'If you believe your copyrighted work has been uploaded to InPlayer without permission, report it using the Report option on the video (choose "Copyright infringement") or email contact@inplayer.in with a description of the work, the URL of the infringing content, and your contact details. We review copyright reports and remove infringing content when a claim is valid.',
    ),
    PolicySectionData(
      '5. Buying and selling on HamMart',
      'HamMart is InPlayer\'s marketplace where independent vendors list and sell their own products. When you buy through HamMart, your contract for that product is with the vendor, not with InPlayer — in line with India\'s Consumer Protection (E-Commerce) Rules, 2020, InPlayer acts as a marketplace connecting you with vendors and is not itself the seller of vendor-listed products.\n\n'
          'Each vendor is responsible for the accuracy of their own listings (including country of origin, price, and description), for the legality and quality of what they sell, and for fulfilling orders. Return, refund, and cancellation terms are set by the vendor and shown on the product/order page; where a vendor hasn\'t stated one, contact support@inplayer.in and we\'ll help resolve it. Report a counterfeit, unsafe, or otherwise problematic product or vendor the same way — see "Grievance Officer" below.\n\n'
          'If you sell on HamMart as a vendor, the separate HamMart Vendor Terms tab applies to you as well.',
    ),
    PolicySectionData(
      '6. Suspension and removal',
      'We may remove content or suspend an account that violates these Terms, including content our automated moderation flags as a serious violation (which is hidden immediately, before any human reviews it) and content removed after a user report. You can contact support@inplayer.in if you believe action was taken on your account in error.',
    ),
    PolicySectionData(
      '7. Disclaimers',
      'InPlayer is provided "as is." We work to keep the service reliable and content appropriately moderated, but we don\'t guarantee the service will be uninterrupted, error-free, or that every piece of content will be caught by moderation before you see it.',
    ),
    PolicySectionData(
      '8. Grievance Officer',
      'In accordance with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, complaints about content on InPlayer — including under "Content you post" above — can be raised with our Grievance Officer:\n\n'
          'Email: support@inplayer.in\n'
          'Homox Prime Pvt Ltd\n\n'
          'We acknowledge complaints within 24 hours and aim to resolve them within 15 days, as required by the Rules. For content that must legally be removed faster — for example non-consensual intimate imagery or impersonation — we act within 24 hours of a valid complaint.',
    ),
    PolicySectionData(
      '9. Changes to these Terms',
      'We may update these Terms as InPlayer changes. If we make a material change, we\'ll update the "Last updated" date above. Continuing to use InPlayer after a change means you accept the updated Terms.',
    ),
    PolicySectionData(
      '10. Contact',
      'Questions about these Terms? Email contact@inplayer.in.',
    ),
  ],
);

const vendorTermsDoc = PolicyDocData(
  title: 'HamMart Vendor Terms',
  lastUpdated: '11 August 2026',
  intro: '',
  sections: [
    PolicySectionData(
      '1. What Hammart is',
      'Hammart is a marketplace feature of InPlayer where independent vendors — individuals or registered businesses — list and sell products directly to InPlayer users. InPlayer operates the listing platform, vendor verification, and buyer-facing storefront, but every purchase remains a sale between you (the vendor) and the buyer. Whether InPlayer takes any cut at all depends on which payment path you use — see Section 4.',
    ),
    PolicySectionData(
      '2. Becoming a verified vendor',
      'Before you can publish a listing, you must complete Hammart\'s business-KYC review: your legal name, PAN, and (for a registered business) GST or Udyam registration number, plus bank/UPI details, reviewed by a real person on the InPlayer team. We may reject or request corrections to any submission. Approval doesn\'t guarantee any particular sales outcome.',
    ),
    PolicySectionData(
      '3. Accurate, honest listings — Rule 6, Consumer Protection (E-Commerce) Rules 2020',
      'Every listing you publish must:\n'
          '• Accurately describe the product — its features, condition, and any material defects. No misleading titles, descriptions, or photos.\n'
          '• Show the total price, including any charges that apply — no hidden costs revealed only after purchase.\n'
          '• State the country of origin and, where applicable, any expiry date, warranty, or guarantee that applies.\n'
          '• Never claim a fake review, fake rating, or false endorsement.\n'
          '• Never list a banned item — see Section 6.\n\n'
          'You are legally responsible for the accuracy of your own listings under the Consumer Protection Act, 2019 and the Consumer Protection (E-Commerce) Rules, 2020. InPlayer may remove any listing that appears to violate this section without prior notice.',
    ),
    PolicySectionData(
      '4. Payment — two ways to get paid, your choice',
      'Setting up automatic online payouts is completely optional — you are never required to do it to sell on Hammart. There are two ways an order gets paid for, and which one applies depends on whether you\'ve set it up:\n\n'
          '• Automatic payouts (optional): if you\'ve completed payout setup, a buyer pays securely online at checkout, and your share of the order — the order total minus InPlayer\'s flat ₹0.50 commission (see Section 8) — is paid out automatically to your bank account. You don\'t need to manually confirm or chase this payment; the order only shows as awaiting your action once payment is verified.\n'
          '• Direct UPI (default until you set up automatic payouts): a buyer pays your own UPI ID directly, the same way Hammart has always worked. InPlayer never sees or processes this payment, so you\'re responsible for checking your own UPI app and confirming an order only once you\'ve actually verified the money arrived. No InPlayer commission applies on this path.\n\n'
          'Either way, you\'re responsible for shipping the product promptly once an order is confirmed as paid.',
    ),
    PolicySectionData(
      '5. Returns, refunds, and cancellations',
      'You must clearly state your own return, refund, and cancellation policy to buyers (in your listing description) and honor it. Regardless of your stated policy, you cannot refuse to accept a return or issue a refund for a product that was defective, materially different from its listing, or not delivered — this is a legal requirement under Rule 6, not optional. Hammart does not currently offer an automated in-app refund flow, so if a refund is owed you are responsible for arranging it directly with the buyer (for example, by bank transfer or UPI) for the amount you actually received.',
    ),
    PolicySectionData(
      '6. Banned items',
      'Hammart does not permit listings for: alcohol; tobacco, cigarettes, vapes, or e-cigarettes; sex toys or other adult/sexual products; illegal drugs or drug paraphernalia; firearms, ammunition, weapons, or explosives; counterfeit or pirated goods; live animals; human body parts or organs; prescription medicines without a valid license; and currency or gambling-related items. Every listing is automatically screened against this list before publishing, and a match is hidden from buyers and flagged for review. Repeated attempts to list banned items may result in suspension of your vendor account.',
    ),
    PolicySectionData(
      '7. Grievance handling',
      'You must respond to a buyer\'s complaint about an order within 48 hours, and work in good faith to resolve it within 30 days, consistent with Rule 6\'s consumer grievance timelines. InPlayer\'s own Grievance Officer for Hammart-related complaints can be reached through the contact details listed in the Terms of Service tab. InPlayer may step in to remove a listing or suspend a vendor account where a complaint is not resolved in good faith.',
    ),
    PolicySectionData(
      '8. Fees & Listing Charges',
      'Verified vendors enjoy unlimited, free product listings on the Hammart marketplace — InPlayer does not currently charge a per-listing fee. For orders paid through automatic online payouts (Section 4), InPlayer keeps a flat commission of ₹0.50 per order, deducted automatically before your payout — you always receive the order total minus this ₹0.50. For orders paid via direct UPI, InPlayer takes no commission at all, since that payment never passes through InPlayer. If this changes in the future, we\'ll update this page and give existing vendors advance notice before any fee change applies.',
    ),
    PolicySectionData(
      '9. Suspension and removal',
      'InPlayer may suspend your vendor account or remove a listing for a violation of these terms, a violation of InPlayer\'s general Terms of Service, a credible buyer complaint, or a legal request. Where reasonably possible, we\'ll tell you why.',
    ),
    PolicySectionData(
      '10. Taxes and legal compliance',
      'You are solely responsible for any GST, income tax, or other legal obligations arising from your sales on Hammart, including registering for GST if your turnover requires it. InPlayer does not file or remit taxes on your behalf.',
    ),
    PolicySectionData(
      '11. Data and privacy',
      'KYC documents you submit (photos of ID, bank proof, business registration) are reviewed by a human and then permanently deleted from our systems — only your legal name, PAN, GST/Udyam number, and bank/UPI details remain on file for compliance and support purposes. See the Privacy Policy tab for how we handle data generally.',
    ),
    PolicySectionData(
      '12. Changes to these terms',
      'We may update these terms as Hammart evolves. Continuing to use your vendor account after an update means you accept the revised terms.',
    ),
  ],
);
