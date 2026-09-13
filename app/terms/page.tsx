import Link from "next/link";
import LegalBackButton from "../components/LegalBackButton";
import LegalNav from "../components/LegalNav";

export const metadata = {
  title: "Terms & Conditions — InPlayer",
  description: "Terms and conditions governing access to and use of the InPlayer platform operated by Homox Prime Private Limited.",
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

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:py-14">
      <LegalBackButton />
      <div className="mt-4">
        <LegalNav />
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#070D1B] p-6 sm:p-8 light:border-slate-200 light:bg-white shadow-xl">
        <div className="border-b border-white/10 pb-6 light:border-slate-200">
          <span className="inline-block rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-orange-400">
            Authoritative Platform Terms
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white light:text-slate-900">
            TERMS &amp; CONDITIONS
          </h1>
          <p className="mt-1 text-sm font-semibold text-orange-300 light:text-orange-600">INPLAYER</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400 light:text-slate-600">
            <p><strong>Effective Date:</strong> {EFFECTIVE_DATE}</p>
            <p><strong>Last Updated:</strong> {LAST_UPDATED}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-300 light:text-slate-700">
          <p>
            These Terms &amp; Conditions (“Terms”, “Agreement”) govern access to and use of the InPlayer mobile
            application, website and related services (“Platform”, “InPlayer”, “Service”) operated by:
          </p>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">HOMOX PRIME PRIVATE LIMITED</p>
            <p className="mt-1">6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris,</p>
            <p>Gorwa, Vadodara, Gujarat – 390016, India</p>
            <p className="mt-1"><strong>GSTIN:</strong> 24AAICH1282J1ZK</p>
            <p><strong>Email:</strong> <a href="mailto:homoxprimepvtltd@gmail.com" className="text-orange-400 hover:underline">homoxprimepvtltd@gmail.com</a></p>
            <p><strong>Support:</strong> <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            <p><strong>Website:</strong> <a href="https://www.inplayer.in" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">www.inplayer.in</a></p>
          </div>

          <p>
            By downloading, accessing, registering on, browsing or using InPlayer, you agree to be legally bound by
            these Terms, our <Link href="/privacy" className="text-orange-400 hover:underline">Privacy Policy</Link>,{" "}
            <Link href="/community-guidelines" className="text-orange-400 hover:underline">Community Guidelines</Link>,{" "}
            <Link href="/creator-monetization" className="text-orange-400 hover:underline">Creator/Monetization Policies</Link>,{" "}
            <Link href="/copyright" className="text-orange-400 hover:underline">Copyright &amp; Intellectual Property Policy</Link>,{" "}
            <Link href="/child-safety" className="text-orange-400 hover:underline">Child Safety Policy</Link>, and any other
            applicable policies published by InPlayer.
          </p>

          <p className="font-semibold text-rose-400">
            If you do not agree with these Terms, you must not access or use the Platform.
          </p>
        </div>

        {/* 1. ABOUT INPLAYER */}
        <Section id="about" title="1. ABOUT INPLAYER">
          <p>InPlayer is an India-focused digital content and creator platform that allows eligible users to:</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>create personal or creator channels;</li>
            <li>upload, publish and share videos and other permitted content;</li>
            <li>watch and interact with content;</li>
            <li>communicate through available chat/community features;</li>
            <li>participate in monetization programs;</li>
            <li>receive eligible creator earnings;</li>
            <li>participate in sponsorship and brand-collaboration opportunities;</li>
            <li>use available shop/e-commerce features; and</li>
            <li>use other features introduced by InPlayer from time to time.</li>
          </ol>
          <p className="font-semibold text-amber-300 light:text-amber-700">
            InPlayer is intended for use within India only.
          </p>
          <p>
            InPlayer does not currently offer its services as an international/global platform, and users must not
            access or use the Platform in a manner that violates applicable Indian law or any applicable territorial
            restriction.
          </p>
        </Section>

        {/* 2. ELIGIBILITY */}
        <Section id="eligibility" title="2. ELIGIBILITY">
          <h3 className="font-bold text-white light:text-slate-900">2.1 General Eligibility</h3>
          <p>You must provide accurate information when creating an account.</p>
          <p>You are responsible for ensuring that your use of InPlayer complies with all applicable laws.</p>
          <p>Where a feature has a minimum age requirement, the user must satisfy that requirement before using that feature.</p>

          <h3 className="mt-4 font-bold text-white light:text-slate-900">2.2 Children and Minors</h3>
          <p>
            For purposes of these Terms, a “Child” means a person below eighteen (18) years of age, subject to applicable Indian law.
          </p>
          <p>
            InPlayer may apply additional safeguards, restrictions, age classification and parental/guardian controls
            to content and features intended for or accessible by children.
          </p>
          <p>Parents or legal guardians are responsible for supervising a minor’s use of the Platform.</p>
        </Section>

        {/* 3. INDIA-ONLY SERVICE */}
        <Section id="india-only" title="3. INDIA-ONLY SERVICE">
          <p>InPlayer is designed and operated as an India-focused service.</p>
          <p>Users must not:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>deliberately circumvent geographic restrictions;</li>
            <li>use technical measures to bypass India-only access restrictions;</li>
            <li>use VPNs, proxies or other methods to defeat restrictions where such use violates Platform rules or applicable law;</li>
            <li>represent themselves falsely to circumvent eligibility restrictions; or</li>
            <li>use the Platform for activities prohibited under applicable Indian law.</li>
          </ul>
          <p>
            InPlayer may restrict, suspend or terminate access where it reasonably believes that a user is
            attempting to circumvent geographical or legal restrictions.
          </p>
        </Section>

        {/* 4. ACCOUNT REGISTRATION */}
        <Section id="registration" title="4. ACCOUNT REGISTRATION">
          <p>Users may be required to create an account to access certain features.</p>
          <p>Depending on the feature, registration may require information such as:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>name;</li>
            <li>mobile number;</li>
            <li>email address;</li>
            <li>date of birth or age information;</li>
            <li>profile information;</li>
            <li>authentication information; and</li>
            <li>other information reasonably necessary to provide the Service.</li>
          </ul>
          <p>You agree that information provided by you will be accurate, current and not misleading.</p>
          <p>You are responsible for maintaining the security of your account credentials and for activities conducted through your account.</p>
          <p>
            You must immediately notify InPlayer if you believe that your account has been compromised at{" "}
            <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a>.
          </p>
        </Section>

        {/* 5. CREATOR CHANNELS */}
        <Section id="creator-channels" title="5. CREATOR CHANNELS">
          <p>InPlayer may allow eligible users to create their own channels. A creator may:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>create a channel;</li>
            <li>upload permitted videos;</li>
            <li>publish content;</li>
            <li>build an audience;</li>
            <li>interact with viewers;</li>
            <li>participate in monetization programs;</li>
            <li>participate in sponsorship opportunities; and</li>
            <li>use other creator features made available by InPlayer.</li>
          </ul>
          <p>InPlayer may impose eligibility requirements before enabling particular creator features.</p>
          <p>
            Creating a channel does not guarantee monetization, audience growth, revenue or continued availability of any feature.
          </p>
        </Section>

        {/* 6. USER-UPLOADED CONTENT */}
        <Section id="uploaded-content" title="6. USER-UPLOADED CONTENT">
          <p>Users may upload videos and other content where the relevant feature is available.</p>
          <p>The person uploading content represents and warrants that:</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>they own the content or have all necessary rights, licences and permissions;</li>
            <li>they have obtained all necessary permissions from persons appearing in the content where required;</li>
            <li>the content does not infringe copyright, trademark, privacy, publicity or other rights;</li>
            <li>the content complies with applicable Indian law;</li>
            <li>the content complies with InPlayer&apos;s Community Guidelines;</li>
            <li>the content does not contain unlawful or prohibited material; and</li>
            <li>the upload does not violate any contractual or legal obligation owed to another person.</li>
          </ol>
          <p className="font-medium text-slate-200 light:text-slate-800">
            The uploader remains primarily responsible for the legality and authenticity of their uploaded content.
          </p>
        </Section>

        {/* 7. CONTENT LICENCE TO INPLAYER */}
        <Section id="licence" title="7. CONTENT LICENCE TO INPLAYER">
          <p className="font-semibold text-emerald-400 light:text-emerald-700">
            You retain ownership of intellectual-property rights in content that you lawfully own.
          </p>
          <p>
            However, by uploading or publishing content on InPlayer, you grant Homox Prime Private Limited a
            non-exclusive, worldwide only to the extent technically necessary for operating the Service, royalty-free,
            sublicensable and transferable licence to host, store, reproduce, encode, technically modify, transmit,
            communicate, publicly display, publicly perform, distribute and make the content available through InPlayer.
          </p>
          <p>This licence exists for purposes including:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>operating the Platform;</li>
            <li>streaming and delivering content;</li>
            <li>displaying content to users;</li>
            <li>technical processing;</li>
            <li>generating thumbnails/previews;</li>
            <li>improving Platform functionality;</li>
            <li>promoting the creator/content within InPlayer;</li>
            <li>providing search and recommendation functionality; and</li>
            <li>complying with legal obligations.</li>
          </ul>
          <p className="font-medium text-slate-200 light:text-slate-800">
            This licence does not transfer ownership of the creator&apos;s underlying copyright to InPlayer.
          </p>
        </Section>

        {/* 8. PROHIBITED CONTENT */}
        <Section id="prohibited-content" title="8. PROHIBITED CONTENT">
          <p>Users must not upload, publish, transmit, promote or distribute content that is unlawful or prohibited.</p>
          <p>Prohibited content may include:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>child sexual abuse material or exploitation;</li>
            <li>sexual content involving minors;</li>
            <li>unlawful pornography;</li>
            <li>content promoting sexual exploitation;</li>
            <li>terrorist or extremist content where prohibited by law;</li>
            <li>content promoting serious criminal activity;</li>
            <li>threats of violence;</li>
            <li>unlawful incitement to violence;</li>
            <li>content that unlawfully promotes hatred or discrimination;</li>
            <li>content encouraging suicide or serious self-harm;</li>
            <li>malware or malicious software;</li>
            <li>scams and fraudulent schemes;</li>
            <li>phishing;</li>
            <li>impersonation;</li>
            <li>content intended to defraud users;</li>
            <li>stolen or unlawfully obtained content;</li>
            <li>copyright-infringing material;</li>
            <li>trademark infringement;</li>
            <li>unlawful disclosure of personal information;</li>
            <li>doxxing;</li>
            <li>non-consensual intimate imagery;</li>
            <li>unlawful surveillance;</li>
            <li>manipulated or deceptive content where prohibited by applicable law;</li>
            <li>content violating court/government orders;</li>
            <li>content violating applicable Indian laws; and</li>
            <li>any other content prohibited by InPlayer policies.</li>
          </ul>
          <p>
            InPlayer may remove, restrict, age-gate, demonetize or otherwise act against content that violates
            these Terms or applicable law.
          </p>
        </Section>

        {/* 9. COPYRIGHT AND INTELLECTUAL PROPERTY */}
        <Section id="copyright" title="9. COPYRIGHT AND INTELLECTUAL PROPERTY">
          <p>InPlayer respects intellectual-property rights.</p>
          <p>Users must not upload or distribute content without appropriate rights.</p>
          <p>
            If a rights holder believes that content on InPlayer infringes their rights, they may submit a complaint/takedown request through the designated grievance/copyright process (see our <Link href="/copyright" className="text-orange-400 hover:underline">Copyright &amp; Intellectual Property Policy</Link>).
          </p>
          <p>InPlayer may:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>restrict access to allegedly infringing content;</li>
            <li>remove content;</li>
            <li>disable monetization;</li>
            <li>restrict the relevant account/channel;</li>
            <li>suspend or terminate repeat infringers; and</li>
            <li>take any other action permitted or required by applicable law.</li>
          </ul>
          <p>False or malicious copyright complaints may result in appropriate action.</p>
        </Section>

        {/* 10. CONTENT MODERATION */}
        <Section id="moderation" title="10. CONTENT MODERATION">
          <p>
            InPlayer may use automated systems, human review, user reports and other reasonable mechanisms to detect or address:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>prohibited content;</li>
            <li>illegal content;</li>
            <li>spam;</li>
            <li>fraud;</li>
            <li>copyright violations;</li>
            <li>abuse;</li>
            <li>child-safety risks;</li>
            <li>harmful behaviour;</li>
            <li>security threats; and</li>
            <li>violations of these Terms.</li>
          </ul>
          <p>InPlayer does not guarantee that every violation will be detected immediately.</p>
          <p>InPlayer may take action before or after publication depending upon the nature and severity of the issue.</p>
        </Section>

        {/* 11. MONETIZATION */}
        <Section id="monetization" title="11. MONETIZATION">
          <p>InPlayer may provide eligible creators with monetization opportunities.</p>
          <p>Monetization may include, depending on the programs available: advertising revenue, creator revenue sharing, sponsorships, brand collaborations, paid promotional opportunities, shop-related earnings, and other monetization mechanisms.</p>
          <p className="font-semibold text-amber-300 light:text-amber-700">Availability of monetization is not guaranteed.</p>
          <p>
            InPlayer may establish separate eligibility criteria, policies, revenue calculations, payout thresholds and verification requirements for each monetization program (see our <Link href="/creator-monetization" className="text-orange-400 hover:underline">Creator Monetization Policy</Link>).
          </p>
          <p>InPlayer may suspend or withhold monetization where there is reasonable evidence of fraud, artificial views, fake engagement, click manipulation, invalid traffic, copyright infringement, policy violations, misleading activity, payment fraud, or other prohibited conduct.</p>
        </Section>

        {/* 12. CREATOR EARNINGS AND PAYMENTS */}
        <Section id="earnings" title="12. CREATOR EARNINGS AND PAYMENTS">
          <p>Creator earnings, where applicable, will be calculated according to the applicable InPlayer monetization policy.</p>
          <p>InPlayer may require creators to complete identity, tax, bank-account and other verification procedures before making payments.</p>
          <p>Creators are responsible for providing accurate payment and tax information.</p>
          <p>Creators are responsible for their own applicable tax obligations arising from their earnings.</p>
          <p>InPlayer may deduct applicable taxes, withholding amounts, fees, adjustments or other legally required amounts before payout.</p>
          <p>Minimum payout thresholds and payment schedules may be specified separately.</p>
          <p className="font-semibold text-amber-300 light:text-amber-700">InPlayer does not guarantee any minimum income or number of views.</p>
        </Section>

        {/* 13. SPONSORSHIPS AND BRAND COLLABORATIONS */}
        <Section id="sponsorships" title="13. SPONSORSHIPS AND BRAND COLLABORATIONS">
          <p>InPlayer may provide sponsorship and brand-collaboration features.</p>
          <p>Creators participating in sponsored content must comply with applicable Indian laws and advertising requirements.</p>
          <p>Creators must not make false, misleading or deceptive claims about a sponsored product or service.</p>
          <p>Where required, sponsored or paid promotional content must be appropriately disclosed.</p>
          <p>InPlayer may restrict sponsorship opportunities for creators who violate applicable laws or Platform policies.</p>
        </Section>

        {/* 14. SHOP / E-COMMERCE FEATURES */}
        <Section id="shop" title="14. SHOP / E-COMMERCE FEATURES">
          <p>InPlayer may provide shopping or marketplace functionality.</p>
          <p>Depending on the applicable feature, creators or sellers may offer products or services through the Platform.</p>
          <p>Where a creator/seller independently sells goods or services:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>the seller is responsible for the accuracy of product information;</li>
            <li>the seller is responsible for lawful sale and fulfilment;</li>
            <li>the seller must comply with applicable consumer-protection laws;</li>
            <li>the seller must not sell prohibited goods or services;</li>
            <li>the seller must provide legally required disclosures;</li>
            <li>the seller must honour applicable warranties/refund obligations; and</li>
            <li>the seller must comply with applicable tax requirements.</li>
          </ul>
          <p>InPlayer may impose additional seller requirements (see <Link href="/hammart-vendor-terms" className="text-orange-400 hover:underline">HamMart Vendor Terms</Link>).</p>
          <p>Where InPlayer acts only as a platform/intermediary, the seller remains responsible for the underlying transaction except to the extent otherwise required by law.</p>
        </Section>

        {/* 15. CHAT AND COMMUNITY FEATURES */}
        <Section id="community" title="15. CHAT AND COMMUNITY FEATURES">
          <p>InPlayer may provide chat, comments, live chat, messaging or community functionality.</p>
          <p>Users must not use these features to harass another person, threaten another person, spam, impersonate another person, spread unlawful content, publish private information without lawful authority, distribute malware, conduct fraud, sexually harass or exploit users, target children improperly, or otherwise violate these Terms.</p>
          <p>InPlayer may remove messages, restrict accounts, disable chat or take other appropriate action.</p>
        </Section>

        {/* 16. CHILD SAFETY AND AGE-APPROPRIATE CONTENT */}
        <Section id="child-safety" title="16. CHILD SAFETY AND AGE-APPROPRIATE CONTENT">
          <p>Child safety is an important part of InPlayer&apos;s Platform design.</p>
          <p>
            InPlayer may use age-related information, age classification systems, parental controls, content ratings and technical safeguards to help provide age-appropriate content (see our <Link href="/child-safety" className="text-orange-400 hover:underline">Child Safety Policy</Link>).
          </p>
          <p>InPlayer may implement an age-estimation/face-scan based mechanism or other technology to estimate a user&apos;s age for safety and content-access purposes.</p>
          <p className="font-semibold text-amber-300 light:text-amber-700">Important limitation: Age estimation is a technological estimate and may not always be accurate.</p>
          <p>Users must not attempt to manipulate, deceive or bypass age-verification or age-estimation mechanisms.</p>
          <p>Where face/age-estimation technology is used, its collection, processing, retention and deletion will be governed by InPlayer&apos;s Privacy Policy and applicable Indian data-protection law.</p>
        </Section>

        {/* 17. PRIVACY AND PERSONAL DATA */}
        <Section id="privacy" title="17. PRIVACY AND PERSONAL DATA">
          <p>InPlayer may collect and process personal information necessary to provide and secure the Service.</p>
          <p>Personal data will be handled in accordance with InPlayer&apos;s <Link href="/privacy" className="text-orange-400 hover:underline">Privacy Policy</Link> and applicable Indian data-protection law (including the Digital Personal Data Protection Act, 2023).</p>
          <p>Users should carefully review the Privacy Policy before using the Platform.</p>
          <p>Where legally required, appropriate consent, notice, rights and safeguards will be provided.</p>
        </Section>

        {/* 18. CAMERA AND AGE-ESTIMATION PERMISSION */}
        <Section id="camera" title="18. CAMERA AND AGE-ESTIMATION PERMISSION">
          <p>Where the age-estimation feature requires camera access, the user may be asked to provide camera permission.</p>
          <p>The user may refuse permission; however, refusal may result in certain age-restricted or safety-related features becoming unavailable.</p>
          <p>InPlayer will not represent an age-estimation result as a guaranteed identification of the user&apos;s actual age.</p>
          <p>Any processing of face-related information must be conducted in accordance with the applicable privacy framework and InPlayer&apos;s Privacy Policy.</p>
        </Section>

        {/* 19. USER REPORTING AND GRIEVANCE REDRESSAL */}
        <Section id="grievance" title="19. USER REPORTING AND GRIEVANCE REDRESSAL">
          <p>Users may report content or accounts that they believe violate these Terms, applicable law or Platform policies.</p>
          <p>Reports may concern: illegal content, child-safety concerns, copyright infringement, harassment, impersonation, privacy violations, fraudulent activity, harmful content, or other policy violations.</p>
          <p>Users should provide sufficient information for InPlayer to investigate the complaint.</p>
          <p>InPlayer will maintain grievance mechanisms and designated contact details as required under applicable Indian law:</p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">Grievance Officer: Mr. Ramchandra Kushwaha</p>
            <p className="mt-1">Homox Prime Private Limited</p>
            <p>6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris, Gorwa, Vadodara, Gujarat – 390016, India</p>
            <p className="mt-1"><strong>Grievance / Support Email:</strong> <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
          </div>
        </Section>

        {/* 20. GOVERNMENT AND LEGAL REQUESTS */}
        <Section id="gov-requests" title="20. GOVERNMENT AND LEGAL REQUESTS">
          <p>InPlayer may cooperate with lawful requests, orders, notices, investigations and directions issued by competent governmental authorities, courts, law-enforcement agencies or other legally authorised bodies.</p>
          <p>Where required by law, InPlayer may preserve, disclose, restrict or remove information/content.</p>
        </Section>

        {/* 21. USER SECURITY */}
        <Section id="security" title="21. USER SECURITY">
          <p>Users must not: hack the Platform; attempt unauthorised access; interfere with servers; introduce malware; reverse engineer the Platform except where legally permitted; circumvent security measures; scrape data through unauthorised means; exploit vulnerabilities for unlawful purposes; or interfere with another user&apos;s account.</p>
          <p>Security vulnerabilities should be responsibly reported to InPlayer at <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a>.</p>
        </Section>

        {/* 22. ARTIFICIAL ENGAGEMENT AND FRAUD */}
        <Section id="artificial-engagement" title="22. ARTIFICIAL ENGAGEMENT AND FRAUD">
          <p>Creators must not artificially increase views, likes, comments, followers, watch time, clicks, advertising interactions, downloads, or revenue.</p>
          <p>Use of bots, automated traffic, click farms, fraudulent accounts or other artificial methods is prohibited.</p>
          <p>InPlayer may invalidate fraudulent activity and adjust or withhold related earnings.</p>
        </Section>

        {/* 23. ADVERTISEMENTS */}
        <Section id="ads" title="23. ADVERTISEMENTS">
          <p>InPlayer may display advertisements, sponsored content, promotional messages or commercial communications.</p>
          <p>Advertising availability, placement and format may change from time to time.</p>
          <p>InPlayer does not necessarily endorse every third-party advertiser, product or service displayed through the Platform.</p>
          <p>Users should independently evaluate third-party products and services before making purchases.</p>
        </Section>

        {/* 24. THIRD-PARTY SERVICES */}
        <Section id="third-party" title="24. THIRD-PARTY SERVICES">
          <p>The Platform may integrate third-party services such as payment processors, analytics providers, cloud infrastructure, authentication providers, advertising services, content-delivery services, age-estimation technology, and other service providers.</p>
          <p>Third-party services may have their own terms and privacy policies. InPlayer is not responsible for third-party services to the extent permitted by applicable law.</p>
        </Section>

        {/* 25. PLATFORM AVAILABILITY */}
        <Section id="availability" title="25. PLATFORM AVAILABILITY">
          <p>InPlayer aims to provide reliable service but does not guarantee uninterrupted availability.</p>
          <p>The Platform may occasionally be unavailable because of maintenance, technical failures, security incidents, network failures, upgrades, third-party failures, government directions, force majeure events, or other circumstances beyond reasonable control.</p>
          <p>InPlayer may modify, suspend or discontinue features at any time, subject to applicable law.</p>
        </Section>

        {/* 26. NO GUARANTEE OF CONTENT AVAILABILITY */}
        <Section id="content-availability" title="26. NO GUARANTEE OF CONTENT AVAILABILITY">
          <p>Content may be removed, restricted, modified or made unavailable at any time due to copyright claims, legal requirements, creator decisions, licensing restrictions, policy violations, technical reasons, age restrictions, or other legitimate reasons.</p>
          <p>InPlayer does not guarantee that any particular video, channel or creator will remain available permanently.</p>
        </Section>

        {/* 27. USER RESPONSIBILITY */}
        <Section id="user-responsibility" title="27. USER RESPONSIBILITY">
          <p>You are responsible for: your account; your uploaded content; your communications; your transactions; your use of monetization features; your compliance with applicable law; and any consequences arising from unlawful or unauthorised use of the Platform.</p>
        </Section>

        {/* 28. ACCOUNT SUSPENSION AND TERMINATION */}
        <Section id="termination" title="28. ACCOUNT SUSPENSION AND TERMINATION">
          <p>InPlayer may suspend, restrict or terminate an account or channel where reasonably necessary, including where a user violates these Terms, violates applicable law, uploads prohibited content, repeatedly infringes copyright, commits fraud, manipulates monetization, threatens child safety, engages in harassment, compromises Platform security, abuses Platform features, or provides materially false information.</p>
          <p>Where appropriate and legally permissible, users may be notified and may have access to an applicable appeal or grievance process.</p>
        </Section>

        {/* 29. CONTENT REMOVAL AND DEMONETIZATION */}
        <Section id="removal-demonetization" title="29. CONTENT REMOVAL AND DEMONETIZATION">
          <p>InPlayer may remove, restrict, age-restrict or demonetize content that violates applicable policies.</p>
          <p className="font-semibold text-amber-300 light:text-amber-700">
            Demonetization may occur independently of removal. A video may remain accessible while monetization is disabled where permitted by Platform policy.
          </p>
        </Section>

        {/* 30. DISCLAIMERS */}
        <Section id="disclaimers" title="30. DISCLAIMERS">
          <p>To the maximum extent permitted by applicable law, InPlayer provides the Platform on an “as available” and “as is” basis.</p>
          <p>InPlayer does not guarantee: any particular number of views; creator earnings; sponsorship opportunities; business success; uninterrupted access; permanent availability of content; accuracy of user-uploaded content; or accuracy of automated age estimation.</p>
          <p>Nothing in these Terms excludes rights or protections that cannot lawfully be excluded under Indian law.</p>
        </Section>

        {/* 31. LIMITATION OF LIABILITY */}
        <Section id="liability" title="31. LIMITATION OF LIABILITY">
          <p>To the maximum extent permitted by applicable Indian law, Homox Prime Private Limited shall not be liable for indirect, incidental, special, consequential or loss-of-profit damages arising from use of the Platform, except where such limitation is prohibited by applicable law.</p>
          <p>Nothing in these Terms shall exclude or limit liability that cannot legally be excluded or limited under applicable law.</p>
        </Section>

        {/* 32. INDEMNIFICATION */}
        <Section id="indemnity" title="32. INDEMNIFICATION">
          <p>To the extent permitted by law, a user agrees to indemnify and hold harmless Homox Prime Private Limited, its officers, employees, affiliates, contractors and service providers against claims, losses, liabilities, damages, costs and expenses arising from: violation of these Terms; unlawful content uploaded by the user; infringement of third-party rights; fraudulent activity; misuse of the Platform; or violation of applicable law.</p>
        </Section>

        {/* 33. INTELLECTUAL PROPERTY OF INPLAYER */}
        <Section id="inplayer-ip" title="33. INTELLECTUAL PROPERTY OF INPLAYER">
          <p>The InPlayer name, logo, branding, software, interface, design, graphics, trademarks, service marks and Platform technology belong to or are lawfully used by Homox Prime Private Limited or its licensors.</p>
          <p>Users may not copy, reproduce, modify, distribute or commercially exploit InPlayer&apos;s proprietary material without prior written permission, except where permitted by law.</p>
        </Section>

        {/* 34. FEEDBACK */}
        <Section id="feedback" title="34. FEEDBACK">
          <p>If you provide suggestions, ideas or feedback regarding InPlayer, you grant InPlayer the right to use such feedback without compensation, subject to applicable law. Feedback does not transfer ownership of your independent intellectual property unless expressly agreed.</p>
        </Section>

        {/* 35. CHANGES TO THESE TERMS */}
        <Section id="changes" title="35. CHANGES TO THESE TERMS">
          <p>InPlayer may modify these Terms from time to time. Updated Terms will be published on the Platform or website.</p>
          <p>Where required by law, users may receive appropriate notice of material changes.</p>
          <p>Continued use of the Platform after the effective date of updated Terms constitutes acceptance to the extent legally permissible.</p>
        </Section>

        {/* 36. GOVERNING LAW */}
        <Section id="governing-law" title="36. GOVERNING LAW">
          <p className="font-semibold text-white light:text-slate-900">
            These Terms shall be governed by and interpreted in accordance with the laws of the Republic of India.
          </p>
          <p>
            Subject to applicable law, courts having competent jurisdiction in Vadodara, Gujarat, India shall have
            jurisdiction over disputes arising from or relating to these Terms.
          </p>
          <p>
            Nothing in this clause prevents a consumer from exercising a mandatory statutory right before a competent
            consumer forum/commission or other authority where applicable law provides otherwise.
          </p>
        </Section>

        {/* 37. SEVERABILITY */}
        <Section id="severability" title="37. SEVERABILITY">
          <p>
            If any provision of these Terms is held invalid or unenforceable by a competent authority, the remaining
            provisions shall continue to remain in effect to the extent permitted by law.
          </p>
        </Section>

        {/* 38. ENTIRE AGREEMENT */}
        <Section id="entire-agreement" title="38. ENTIRE AGREEMENT">
          <p>
            These Terms, together with the Privacy Policy, Community Guidelines, Creator/Monetization Policies and
            other applicable Platform policies, constitute the agreement governing your use of InPlayer, subject to
            applicable law.
          </p>
        </Section>

        {/* 39. CONTACT INFORMATION */}
        <Section id="contact" title="39. CONTACT INFORMATION">
          <p>For general support:</p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">Homox Prime Private Limited</p>
            <p className="mt-1">6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris,</p>
            <p>Gorwa, Vadodara, Gujarat – 390016, India</p>
            <p className="mt-1"><strong>General Email:</strong> <a href="mailto:homoxprimepvtltd@gmail.com" className="text-orange-400 hover:underline">homoxprimepvtltd@gmail.com</a></p>
            <p><strong>Support Email:</strong> <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            <p><strong>Website:</strong> <a href="https://www.inplayer.in" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">www.inplayer.in</a></p>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            For legal, copyright, grievance or compliance matters, users should use the designated contact mechanism published by InPlayer.
          </p>
        </Section>

        {/* 40. ACCEPTANCE */}
        <Section id="acceptance" title="40. ACCEPTANCE">
          <p>
            By clicking “I Agree”, “Accept”, creating an account, uploading content, creating a channel, using the
            Platform or otherwise accessing InPlayer, you acknowledge that:
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>you have read these Terms;</li>
            <li>you understand these Terms;</li>
            <li>you agree to be bound by these Terms; and</li>
            <li>you will comply with applicable Indian law and InPlayer policies.</li>
          </ol>
          <p className="mt-6 font-bold uppercase tracking-wider text-orange-400">END OF TERMS &amp; CONDITIONS</p>
          <p className="text-xs text-slate-500">HOMOX PRIME PRIVATE LIMITED · INPLAYER</p>
        </Section>
      </div>
    </div>
  );
}
