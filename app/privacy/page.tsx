import Link from "next/link";
import LegalBackButton from "../components/LegalBackButton";
import LegalNav from "../components/LegalNav";

export const metadata = {
  title: "Privacy Policy — InPlayer",
  description: "Comprehensive privacy policy of InPlayer operated by Homox Prime Private Limited, in compliance with Indian data protection laws and DPDPA 2023.",
};

const EFFECTIVE_DATE = "September 5, 2026";
const LAST_UPDATED = "September 5, 2026";

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-8 border-t border-white/5 pt-6 light:border-slate-200">
      <h2 className="text-lg font-black text-white light:text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300 light:text-slate-700">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:py-14">
      <LegalBackButton />
      <div className="mt-4">
        <LegalNav />
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#070D1B] p-6 sm:p-8 light:border-slate-200 light:bg-white shadow-xl">
        <div className="border-b border-white/10 pb-6 light:border-slate-200">
          <span className="inline-block rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-orange-400">
            Authoritative Privacy Standards
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white light:text-slate-900">
            PRIVACY POLICY
          </h1>
          <p className="mt-1 text-sm font-semibold text-orange-300 light:text-orange-600">INPLAYER</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400 light:text-slate-600">
            <p><strong>Effective Date:</strong> {EFFECTIVE_DATE}</p>
            <p><strong>Last Updated:</strong> {LAST_UPDATED}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-300 light:text-slate-700">
          <p>
            This Privacy Policy explains how Homox Prime Private Limited (“InPlayer”, “we”, “us”, “our”) collects,
            uses, stores, processes, shares and protects personal information when you access or use the InPlayer
            mobile application, website, creator services, shopping features, communication features and related
            services (collectively, the “Platform”).
          </p>

          <p className="font-semibold text-amber-300 light:text-amber-700">
            This Privacy Policy applies to users located in India and to the use of InPlayer within India.
          </p>
        </div>

        {/* 1. DATA CONTROLLER / PLATFORM OPERATOR */}
        <Section id="data-controller" title="1. DATA CONTROLLER / PLATFORM OPERATOR">
          <p>The InPlayer Platform is operated by:</p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">HOMOX PRIME PRIVATE LIMITED</p>
            <p className="mt-1"><strong>Registered/Office Address:</strong></p>
            <p>6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris,</p>
            <p>Gorwa, Vadodara, Gujarat – 390016, India</p>
            <p className="mt-1"><strong>GSTIN:</strong> 24AAICH1282J1ZK</p>
            <p><strong>General Email:</strong> <a href="mailto:homoxprimepvtltd@gmail.com" className="text-orange-400 hover:underline">homoxprimepvtltd@gmail.com</a></p>
            <p><strong>Support Email:</strong> <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            <p><strong>Website:</strong> <a href="https://www.inplayer.in" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">www.inplayer.in</a></p>
            <p><strong>App Name:</strong> InPlayer</p>
          </div>
        </Section>

        {/* 2. SCOPE OF THIS PRIVACY POLICY */}
        <Section id="scope" title="2. SCOPE OF THIS PRIVACY POLICY">
          <p>This Privacy Policy applies to information collected through:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>InPlayer Android application;</li>
            <li>InPlayer iOS application;</li>
            <li>InPlayer website;</li>
            <li>creator channels;</li>
            <li>video-upload services;</li>
            <li>In-Family features;</li>
            <li>comments and likes;</li>
            <li>chat/community features;</li>
            <li>monetization services;</li>
            <li>sponsorship features;</li>
            <li>shop/marketplace services;</li>
            <li>seller/vendor services;</li>
            <li>advertising services;</li>
            <li>customer support; and</li>
            <li>other services introduced by InPlayer.</li>
          </ul>
          <p>By using InPlayer, you acknowledge that you have read and understood this Privacy Policy.</p>
        </Section>

        {/* 3. INDIA-ONLY PLATFORM */}
        <Section id="india-only" title="3. INDIA-ONLY PLATFORM">
          <p>InPlayer is intended for use within India.</p>
          <p>The Platform is not designed or offered as a global/international service.</p>
          <p>Users must use InPlayer in accordance with applicable Indian law.</p>
          <p>
            Where technically necessary, InPlayer may use location or network information to support geographic
            restrictions and India-focused service delivery.
          </p>
        </Section>

        {/* 4. INFORMATION WE COLLECT */}
        <Section id="info-we-collect" title="4. INFORMATION WE COLLECT">
          <p>Depending on how you use InPlayer, we may collect different categories of information.</p>
          <h3 className="font-bold text-white light:text-slate-900">4.1 Google Account Information</h3>
          <p>Users may sign in using Google Sign-In.</p>
          <p>Depending on the permissions and authentication information made available by Google, we may receive information such as: name, email address, Google account identifier, profile information/profile image, where applicable, and authentication-related information.</p>
          <p className="font-medium text-slate-200 light:text-slate-800">Your email address is not intended to be displayed publicly on your InPlayer profile.</p>
          <p>Google authentication is subject to Google&apos;s own privacy practices and terms.</p>
        </Section>

        {/* 5. PROFILE INFORMATION */}
        <Section id="profile-info" title="5. PROFILE INFORMATION">
          <p>Users may create a profile/channel and may provide information such as: name, username, age or age-related information, profile photograph, channel information, biography, creator information, and other information voluntarily provided by the user.</p>
          <p className="text-amber-300 light:text-amber-700 font-medium">Users should avoid publishing sensitive personal information in public profiles.</p>
        </Section>

        {/* 6. USER-GENERATED CONTENT */}
        <Section id="user-content" title="6. USER-GENERATED CONTENT">
          <p>InPlayer is a creator-focused video platform. Users may create channels and upload content where the relevant feature is available.</p>
          <p>We may collect and process: videos, thumbnails, titles, descriptions, comments, likes, views, followers/subscribers, channel information, playlists or similar content information, reports and moderation information, and other information associated with uploaded content.</p>
          <p>Content uploaded by users may be publicly visible depending on the creator&apos;s selected settings and the features available on InPlayer.</p>
        </Section>

        {/* 7. COMMENTS, LIKES AND SOCIAL ACTIVITY */}
        <Section id="social-activity" title="7. COMMENTS, LIKES AND SOCIAL ACTIVITY">
          <p>When you interact with content, we may process information relating to: comments, likes, follows, views, shares, engagement, reports, interactions with creators, and other Platform activity.</p>
          <p>This information may be used to provide social and recommendation functionality, improve the Platform and support creator analytics and monetization.</p>
        </Section>

        {/* 8. IN-FAMILY FEATURE */}
        <Section id="in-family" title="8. IN-FAMILY FEATURE">
          <p>InPlayer may provide a feature referred to as “In-Family”. In-Family is not necessarily a paid subscription service.</p>
          <p>Information associated with In-Family may be processed to provide family-related features, account relationships, content controls and other functionality made available through the Platform. Specific In-Family features may change over time.</p>
        </Section>

        {/* 9. FACE SCAN AND AGE ESTIMATION */}
        <Section id="face-scan" title="9. FACE SCAN AND AGE ESTIMATION">
          <h3 className="font-bold text-white light:text-slate-900">9.1 Purpose</h3>
          <p>
            InPlayer may use an age-estimation technology involving a camera/face scan for child safety and age-appropriate content access.
            The primary purpose is to estimate whether the person using the device appears to fall within an appropriate age group (e.g. child/minor, teenage/minor, or adult/18+).
            The purpose is to help ensure that a user who appears to be a child is not unnecessarily presented with content intended for adults.
          </p>

          <h3 className="mt-4 font-bold text-white light:text-slate-900">9.2 No Intended Permanent Storage of Face Scan</h3>
          <p className="font-semibold text-emerald-400 light:text-emerald-700">
            InPlayer&apos;s intended design is that the face image/video captured for age estimation is not retained as a
            permanent user profile or biometric record after the age-estimation process is completed, subject to the technical
            processing performed by the relevant age-estimation service provider.
          </p>
          <p>InPlayer does not intend to create or maintain a permanent facial-recognition database from these scans.</p>

          <h3 className="mt-4 font-bold text-white light:text-slate-900">9.3 Age Estimation Is Not Identity Verification</h3>
          <p>The face scan is intended for age estimation and content-safety purposes. It is not intended to establish a user&apos;s legal identity.</p>
          <p>Age estimation may not always be accurate. Users must not attempt to manipulate or bypass the age-safety system.</p>

          <h3 className="mt-4 font-bold text-white light:text-slate-900">9.4 Third-Party Technology</h3>
          <p>
            InPlayer may use third-party technology or services, including technology provided by Google or another service provider,
            to assist with age estimation. Such processing may be subject to the relevant provider&apos;s technical and privacy practices.
          </p>
        </Section>

        {/* 10. CHILD SAFETY */}
        <Section id="child-safety" title="10. CHILD SAFETY">
          <p>Child safety is an important part of InPlayer&apos;s Platform.</p>
          <p className="font-semibold text-white light:text-slate-900">
            A “child” means a person below eighteen (18) years of age under the applicable Indian intermediary framework.
          </p>
          <p>InPlayer may use: age estimation, age classification, content categorisation, content restrictions, parental/family features, reporting mechanisms, moderation systems, and other technical safeguards to reduce the risk of children being exposed to inappropriate content (see our <Link href="/child-safety" className="text-orange-400 hover:underline">Child Safety Policy</Link>).</p>
          <p>InPlayer does not knowingly intend to use children&apos;s personal data for purposes unrelated to providing, securing and protecting the Platform except where permitted or required by applicable law.</p>
          <p>Where applicable Indian law requires additional consent, safeguards or restrictions relating to children, InPlayer will implement such requirements according to the applicable legal framework.</p>
        </Section>

        {/* 11. CAMERA PERMISSION */}
        <Section id="camera" title="11. CAMERA PERMISSION">
          <p>The camera may be requested for age estimation, age-safety functions, or other camera-based features introduced by InPlayer.</p>
          <p>Users may deny camera permission. However, refusing camera access may prevent certain age-safety or age-restricted features from functioning.</p>
          <p>InPlayer will not use the camera for unrelated purposes without an appropriate legal basis or permission where required.</p>
        </Section>

        {/* 12. LOCATION INFORMATION */}
        <Section id="location" title="12. LOCATION INFORMATION">
          <p>InPlayer may collect location-related information where the relevant feature is enabled or where such information is required for legitimate Platform functions.</p>
          <p>Location information may be used for monetization eligibility, creator services, fraud/security prevention, regulatory compliance, regional content, service availability, advertising, recommendations, shop functionality, and analytics.</p>
        </Section>

        {/* 13. CREATOR MONETIZATION INFORMATION */}
        <Section id="monetization-info" title="13. CREATOR MONETIZATION INFORMATION">
          <p>Creators who participate in monetization may be required to provide information necessary for: identity verification, KYC, payment processing, tax compliance, fraud prevention, creator eligibility, revenue payouts, and legal/regulatory compliance.</p>
          <p>Information may include bank account details, UPI ID, PAN, Aadhaar/KYC information, GST details, billing address, and identity documents (see <Link href="/creator-monetization" className="text-orange-400 hover:underline">Creator Monetization Policy</Link>).</p>
        </Section>

        {/* 14. SELLER / VENDOR INFORMATION */}
        <Section id="vendor-info" title="14. SELLER / VENDOR INFORMATION">
          <p>Users who participate in the InPlayer shop or marketplace may be required to complete vendor/seller verification.</p>
          <p>Information may include business name, contact details, address, PAN, GST, bank account, and KYC documents (see <Link href="/hammart-vendor-terms" className="text-orange-400 hover:underline">HamMart Vendor Terms</Link>).</p>
        </Section>

        {/* 15. PAYMENT INFORMATION */}
        <Section id="payment-info" title="15. PAYMENT INFORMATION">
          <p>Where InPlayer facilitates or supports payments, payments may be processed through third-party payment processors.</p>
          <p>Depending on the transaction, we may process transaction IDs, payment status, payment amounts, payer/payee details, and billing information. Where a third-party payment processor handles payment cards or credentials directly, that processing is governed by the provider&apos;s terms and privacy policy.</p>
        </Section>

        {/* 16. SHOP AND ORDER INFORMATION */}
        <Section id="orders" title="16. SHOP AND ORDER INFORMATION">
          <p>When users purchase or sell products through InPlayer, information may be processed for order processing, payment, delivery, customer support, returns/refunds, fraud prevention, seller verification, dispute resolution, legal compliance, and transaction records.</p>
        </Section>

        {/* 17. ADVERTISING */}
        <Section id="advertising" title="17. ADVERTISING">
          <p>InPlayer may display advertisements. At present, InPlayer may use Google advertising services.</p>
          <p>Advertising partners may process device information, advertising identifiers, approximate location, app activity, and ad interactions.</p>
        </Section>

        {/* 18. ANALYTICS AND APP PERFORMANCE */}
        <Section id="analytics" title="18. ANALYTICS AND APP PERFORMANCE">
          <p>InPlayer may use third-party services to understand how the Platform is used and to improve performance. These services may include: Firebase, Google Analytics, Google Play Services, Apple services, Crashlytics, OneSignal, Meta/Facebook SDK, cloud/CDN providers, payment providers, and security providers.</p>
          <p>Technical information processed includes device type, operating system, app version, IP address, approximate location, crash information, and usage events.</p>
        </Section>

        {/* 19. PUSH NOTIFICATIONS */}
        <Section id="notifications" title="19. PUSH NOTIFICATIONS">
          <p>InPlayer may use services such as OneSignal or other notification providers to send account, creator, content, security, transactional, and promotional notifications. Users may manage permissions in device settings.</p>
        </Section>

        {/* 20. COOKIES AND SIMILAR TECHNOLOGIES */}
        <Section id="cookies" title="20. COOKIES AND SIMILAR TECHNOLOGIES">
          <p>The InPlayer website and certain services may use cookies, SDKs, pixels, local storage and similar technologies for login/session management, security, analytics, preferences, advertising, and performance.</p>
        </Section>

        {/* 21. HOW WE USE PERSONAL DATA */}
        <Section id="use-of-data" title="21. HOW WE USE PERSONAL DATA">
          <p>InPlayer may use personal information for purposes including:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>creating and managing accounts;</li>
            <li>providing the Platform;</li>
            <li>providing creator services;</li>
            <li>hosting and delivering videos;</li>
            <li>providing age-appropriate content;</li>
            <li>child safety;</li>
            <li>age estimation;</li>
            <li>providing In-Family features;</li>
            <li>processing payments;</li>
            <li>creator monetization;</li>
            <li>KYC and identity verification;</li>
            <li>seller/vendor verification;</li>
            <li>shop transactions;</li>
            <li>fraud prevention;</li>
            <li>cybersecurity;</li>
            <li>customer support;</li>
            <li>grievance handling;</li>
            <li>content moderation;</li>
            <li>enforcing Platform Terms;</li>
            <li>preventing abuse;</li>
            <li>analytics;</li>
            <li>improving services;</li>
            <li>advertising;</li>
            <li>sponsorship services;</li>
            <li>recommendations;</li>
            <li>complying with legal obligations;</li>
            <li>responding to lawful governmental requests; and</li>
            <li>protecting the rights, safety and security of users and InPlayer.</li>
          </ol>
        </Section>

        {/* 22. LEGAL BASIS AND CONSENT */}
        <Section id="legal-basis" title="22. LEGAL BASIS AND CONSENT">
          <p>InPlayer will process personal data in accordance with applicable Indian data-protection requirements (including the Digital Personal Data Protection Act, 2023).</p>
          <p>Where consent is required, InPlayer may request consent before processing personal data for the relevant purpose. Where processing is permitted or required by applicable law without separate consent, InPlayer may process information for such lawful purpose.</p>
        </Section>

        {/* 23. DATA SHARING */}
        <Section id="sharing" title="23. DATA SHARING">
          <p className="font-semibold text-emerald-400 light:text-emerald-700">
            InPlayer does not intend to sell users&apos; personal data as a standalone commercial product.
          </p>
          <p>Personal information may be shared with appropriate parties where necessary to operate the Platform or comply with law, including: Google, Firebase, Apple, Crashlytics, OneSignal, payment processors, KYC/identity verification providers, cloud/CDN providers, security providers, customer-support providers, law-enforcement authorities, and courts.</p>
        </Section>

        {/* 24. GOVERNMENT AND LAW-ENFORCEMENT DISCLOSURES */}
        <Section id="law-enforcement" title="24. GOVERNMENT AND LAW-ENFORCEMENT DISCLOSURES">
          <p>InPlayer may disclose or preserve information where reasonably necessary to comply with applicable Indian law, comply with a valid court order, respond to lawful governmental requests, prevent or investigate fraud, investigate cybersecurity incidents, protect users, protect InPlayer&apos;s legal rights, or comply with regulatory obligations.</p>
        </Section>

        {/* 25. DATA RETENTION */}
        <Section id="retention" title="25. DATA RETENTION">
          <p>InPlayer will retain personal information only for as long as reasonably necessary for the relevant purpose, subject to applicable legal, regulatory, tax, accounting, security and dispute-resolution requirements.</p>
          <p>Examples: account info while active; transaction records for statutory accounting periods; support records while resolving disputes; age-estimation face captures are intended not to be permanently retained after processing.</p>
        </Section>

        {/* 26. DATA DELETION */}
        <Section id="deletion" title="26. DATA DELETION">
          <p>Users may request deletion of their account and applicable personal information subject to applicable law, outstanding legal obligations, fraud/security requirements, financial recordkeeping, dispute resolution, and legal claims.</p>
          <p>Deletion of an account may not immediately result in deletion of every record where retention is legally required.</p>
          <p>
            Users can request account deletion in the app via Settings, or via our public deletion resource at{" "}
            <Link href="/delete-account" className="text-orange-400 hover:underline">/delete-account</Link>.
          </p>
        </Section>

        {/* 27. DATA SECURITY */}
        <Section id="security" title="27. DATA SECURITY">
          <p>InPlayer will take reasonable technical and organisational measures appropriate to the nature of personal information and the risks involved (access controls, authentication controls, encryption, monitoring, logging, backups, vulnerability management).</p>
          <p>No internet-based service can guarantee absolute security. Users should protect their credentials.</p>
        </Section>

        {/* 28. DATA BREACHES */}
        <Section id="breaches" title="28. DATA BREACHES">
          <p>If InPlayer becomes aware of a personal-data breach requiring notification under applicable law, InPlayer will take appropriate steps required by the applicable legal framework, including notifications to relevant authorities and/or affected users where legally required.</p>
        </Section>

        {/* 29. CHILDREN'S PERSONAL DATA */}
        <Section id="children-data" title="29. CHILDREN'S PERSONAL DATA">
          <p>InPlayer recognises that children require enhanced safeguards.</p>
          <p>Where a user is identified or reasonably believed to be a child, InPlayer may apply additional protections, content restrictions and processing limitations in accordance with applicable Indian law.</p>
          <p>InPlayer will not intentionally use a child&apos;s personal information for unrelated commercial purposes where prohibited by applicable law.</p>
        </Section>

        {/* 30. USER CONTROL AND DEVICE PERMISSIONS */}
        <Section id="permissions" title="30. USER CONTROL AND DEVICE PERMISSIONS">
          <p>Depending on feature usage, users may be asked for permissions (camera, microphone, photos/media, location, notifications, storage). Users can manage these in Android or iOS settings.</p>
        </Section>

        {/* 31. THIRD-PARTY LINKS AND SERVICES */}
        <Section id="third-party-links" title="31. THIRD-PARTY LINKS AND SERVICES">
          <p>InPlayer may contain links to or integrations with third-party websites or applications. InPlayer is not responsible for the privacy practices of independent third parties.</p>
        </Section>

        {/* 32. INTERNATIONAL PROCESSING */}
        <Section id="international" title="32. INTERNATIONAL PROCESSING">
          <p>InPlayer is intended for use in India. However, certain third-party technology providers, cloud providers, analytics providers or service providers used by InPlayer may process information through infrastructure located outside India.</p>
          <p>Where personal information is processed outside India, InPlayer will seek to comply with applicable Indian legal requirements relating to such processing and transfers.</p>
        </Section>

        {/* 33. YOUR PRIVACY RIGHTS */}
        <Section id="rights" title="33. YOUR PRIVACY RIGHTS">
          <p>Subject to applicable Indian law, users may have rights relating to their personal information, including:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>requesting information about processing;</li>
            <li>requesting access to applicable personal information;</li>
            <li>requesting correction;</li>
            <li>requesting deletion where applicable;</li>
            <li>withdrawing consent where processing is based on consent;</li>
            <li>raising a grievance; and</li>
            <li>nominating or exercising applicable rights in relation to a child/person with lawful authority.</li>
          </ul>
        </Section>

        {/* 34. WITHDRAWAL OF CONSENT */}
        <Section id="withdraw-consent" title="34. WITHDRAWAL OF CONSENT">
          <p>Where processing is based on consent, users may withdraw consent through the available mechanism or by contacting InPlayer. Withdrawal of consent may affect feature availability.</p>
        </Section>

        {/* 35. ACCOUNT DELETION REQUEST */}
        <Section id="deletion-request" title="35. ACCOUNT DELETION REQUEST">
          <p>Users who wish to delete their InPlayer account may use the account-deletion mechanism provided in the application, or via our web resource at <Link href="/delete-account" className="text-orange-400 hover:underline">inplayer.in/delete-account</Link>, or contact:</p>
          <p className="font-semibold text-orange-400"><a href="mailto:support@inplayer.in">support@inplayer.in</a></p>
          <p>InPlayer may request reasonable information to verify the identity of the requester.</p>
        </Section>

        {/* 36. GRIEVANCE REDRESSAL */}
        <Section id="grievance" title="36. GRIEVANCE REDRESSAL">
          <p>InPlayer has designated the following person for privacy/grievance-related concerns:</p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">Grievance Officer / Grievance Contact: Mr. Ramchandra Kushwaha</p>
            <p className="mt-1"><strong>Company:</strong> Homox Prime Private Limited</p>
            <p><strong>Address:</strong> 6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris, Gorwa, Vadodara, Gujarat – 390016, India</p>
            <p className="mt-1"><strong>Email:</strong> <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
          </div>
        </Section>

        {/* 37. COPYRIGHT AND PRIVACY COMPLAINTS */}
        <Section id="complaints" title="37. COPYRIGHT AND PRIVACY COMPLAINTS">
          <p>If a user believes that their personal information, image, copyrighted work or other protected rights have been unlawfully used on InPlayer, they may submit a complaint to <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a> or use the dedicated <Link href="/copyright" className="text-orange-400 hover:underline">Report Copyright</Link> mechanism.</p>
        </Section>

        {/* 38. CHANGES TO THIS PRIVACY POLICY */}
        <Section id="changes" title="38. CHANGES TO THIS PRIVACY POLICY">
          <p>InPlayer may update this Privacy Policy from time to time. The updated version will be published on the Platform/website with an updated “Last Updated” date. Where legally required, InPlayer will provide additional notice or obtain consent.</p>
        </Section>

        {/* 39. CONTACT INFORMATION */}
        <Section id="contact" title="39. CONTACT INFORMATION">
          <p>For privacy-related questions, requests or concerns:</p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">HOMOX PRIME PRIVATE LIMITED</p>
            <p className="mt-1">6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris,</p>
            <p>Gorwa, Vadodara, Gujarat – 390016, India</p>
            <p className="mt-1"><strong>Email:</strong> <a href="mailto:homoxprimepvtltd@gmail.com" className="text-orange-400 hover:underline">homoxprimepvtltd@gmail.com</a></p>
            <p><strong>Support:</strong> <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            <p><strong>Website:</strong> <a href="https://www.inplayer.in" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">www.inplayer.in</a></p>
            <p><strong>Grievance Officer:</strong> Mr. Ramchandra Kushwaha</p>
          </div>
        </Section>

        {/* 40. ACCEPTANCE */}
        <Section id="acceptance" title="40. ACCEPTANCE">
          <p>By accessing or using InPlayer, you acknowledge that you have read and understood this Privacy Policy.</p>
          <p>Where applicable, InPlayer will obtain consent or provide required notices before collecting or processing personal information.</p>
          <p className="mt-6 font-bold uppercase tracking-wider text-orange-400">END OF PRIVACY POLICY</p>
          <p className="text-xs text-slate-500">HOMOX PRIME PRIVATE LIMITED · INPLAYER</p>
        </Section>
      </div>
    </div>
  );
}
