import Link from "next/link";
import LegalBackButton from "../components/LegalBackButton";
import LegalNav from "../components/LegalNav";

export const metadata = {
  title: "Child Safety Policy — InPlayer",
  description: "Official Child Safety Policy of InPlayer operated by Homox Prime Private Limited, establishing zero tolerance for child exploitation and setting standards for young audiences under Indian law.",
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

export default function ChildSafetyPage() {
  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:py-14">
      <LegalBackButton />
      <div className="mt-4">
        <LegalNav />
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#070D1B] p-6 sm:p-8 light:border-slate-200 light:bg-white shadow-xl">
        <div className="border-b border-white/10 pb-6 light:border-slate-200">
          <span className="inline-block rounded-full bg-rose-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-rose-400">
            Protection &amp; Safeguards
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white light:text-slate-900">
            CHILD SAFETY POLICY
          </h1>
          <p className="mt-1 text-sm font-semibold text-orange-300 light:text-orange-600">INPLAYER</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400 light:text-slate-600">
            <p><strong>Effective Date:</strong> {EFFECTIVE_DATE}</p>
            <p><strong>Last Updated:</strong> {LAST_UPDATED}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-300 light:text-slate-700">
          <p>
            InPlayer is committed to providing a safe digital environment for children and users of all age groups.
            InPlayer is an India-focused video and creator platform operated by:
          </p>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">HOMOX PRIME PRIVATE LIMITED</p>
            <p className="mt-1">6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris,</p>
            <p>Gorwa, Vadodara, Gujarat – 390016, India</p>
            <p className="mt-1"><strong>GSTIN:</strong> 24AAICH1282J1ZK</p>
            <p><strong>Support:</strong> <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            <p><strong>General Email:</strong> <a href="mailto:homoxprimepvtltd@gmail.com" className="text-orange-400 hover:underline">homoxprimepvtltd@gmail.com</a></p>
            <p><strong>Website:</strong> <a href="https://www.inplayer.in" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">www.inplayer.in</a></p>
          </div>

          <p>
            This Child Safety Policy explains how InPlayer seeks to protect children from sexual exploitation,
            grooming, inappropriate content, harassment, abuse, harmful interactions and other online risks.
            This Policy forms part of the InPlayer <Link href="/terms" className="text-orange-400 hover:underline">Terms &amp; Conditions</Link>,{" "}
            <Link href="/privacy" className="text-orange-400 hover:underline">Privacy Policy</Link> and{" "}
            <Link href="/community-guidelines" className="text-orange-400 hover:underline">Community Guidelines</Link>.
          </p>
        </div>

        {/* 1. PURPOSE */}
        <Section id="purpose" title="1. PURPOSE">
          <p>This Child Safety Policy explains how InPlayer seeks to protect children from sexual exploitation, grooming, inappropriate content, harassment, abuse, harmful interactions and other online risks.</p>
        </Section>

        {/* 2. WHO IS A CHILD? */}
        <Section id="who-is-child" title="2. WHO IS A CHILD?">
          <p className="font-semibold text-white light:text-slate-900">
            For purposes of this Policy, a child means a person below 18 years of age, consistent with the applicable Indian intermediary framework.
          </p>
          <p>InPlayer may use age-related information and technical age-estimation mechanisms to determine an approximate age category for safety and content-recommendation purposes.</p>
          <p>Age estimation is not a legal identity verification system and may not always accurately determine a person&apos;s actual age.</p>
        </Section>

        {/* 3. INPLAYER IS AN ALL-AGE PLATFORM */}
        <Section id="all-age" title="3. INPLAYER IS AN ALL-AGE PLATFORM">
          <p>InPlayer is designed as an all-age platform.</p>
          <p>The Platform is intended to provide age-appropriate experiences to users while maintaining strict safeguards against content or conduct that could harm children.</p>
          <p>Creators are responsible for ensuring that their content complies with InPlayer&apos;s Community Guidelines and Child Safety Policy.</p>
        </Section>

        {/* 4. ZERO TOLERANCE FOR CHILD SEXUAL EXPLOITATION */}
        <Section id="zero-tolerance" title="4. ZERO TOLERANCE FOR CHILD SEXUAL EXPLOITATION">
          <p className="font-semibold text-rose-400">InPlayer has zero tolerance for:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>child sexual abuse;</li>
            <li>child sexual exploitation;</li>
            <li>child sexual abuse material (CSAM);</li>
            <li>sexualisation of children;</li>
            <li>sexual solicitation of children;</li>
            <li>grooming;</li>
            <li>sexual extortion of children;</li>
            <li>trafficking or exploitation of children;</li>
            <li>commercial sexual exploitation of children;</li>
            <li>requests for sexual images from children;</li>
            <li>sharing sexual material involving children;</li>
            <li>arranging sexual contact with children; or</li>
            <li>any other conduct that sexually exploits or endangers a child.</li>
          </ul>
          <p className="font-semibold text-rose-400">
            Such conduct may result in immediate account termination and reporting to competent authorities where required by applicable law.
          </p>
        </Section>

        {/* 5. PROHIBITED CHILD SEXUAL CONTENT */}
        <Section id="prohibited-content" title="5. PROHIBITED CHILD SEXUAL CONTENT">
          <p>Users must never upload, share, request, create, generate, distribute or promote content that sexually exploits or sexualises a child.</p>
          <p>This includes: photographs; videos; livestreams; AI-generated content; digitally manipulated content; deepfakes; drawings or animations where prohibited by applicable law; audio; messages; links; advertisements; and any other material used to sexually exploit children.</p>
          <p className="font-semibold text-amber-300 light:text-amber-700">
            A claim that content was generated by AI or is fictional does not make otherwise unlawful child sexual exploitation acceptable.
          </p>
        </Section>

        {/* 6. GROOMING */}
        <Section id="grooming" title="6. GROOMING">
          <p>InPlayer prohibits grooming of children.</p>
          <p>Grooming may include behaviour intended to build trust with a child for the purpose of: sexual exploitation; obtaining sexual images; arranging inappropriate meetings; sexual conversations; coercion; manipulation; blackmail; trafficking; or other exploitation.</p>
          <p>Users must not use InPlayer&apos;s comments, chat, livestreams, profiles or other features to groom children.</p>
        </Section>

        {/* 7. SEXUAL SOLICITATION OF MINORS */}
        <Section id="solicitation" title="7. SEXUAL SOLICITATION OF MINORS">
          <p>Users must not: ask children for sexual photographs; request sexual videos; request sexual conversations; ask children to move to another platform for sexual purposes; offer money or gifts in exchange for sexual material; threaten children into providing sexual material; or attempt to arrange sexual contact with a child.</p>
          <p className="font-semibold text-rose-400">Such conduct may result in immediate suspension or permanent termination.</p>
        </Section>

        {/* 8. NON-CONSENSUAL OR EXPLOITATIVE CONTENT */}
        <Section id="non-consensual" title="8. NON-CONSENSUAL OR EXPLOITATIVE CONTENT">
          <p>InPlayer prohibits content involving: sexual exploitation of minors; intimate material involving minors; non-consensual intimate imagery; sexual blackmail; sextortion; threats involving private images; and exploitation of children for commercial purposes.</p>
          <p>Users should report such material immediately rather than downloading, copying or redistributing it.</p>
        </Section>

        {/* 9. ADULT SEXUAL CONTENT */}
        <Section id="adult-content" title="9. ADULT SEXUAL CONTENT">
          <p>InPlayer is an all-age platform and explicit pornography and explicit adult sexual content are prohibited.</p>
          <p>Users must not upload or distribute: pornography; explicit sexual acts; explicit sexual videos; sexual exploitation; explicit sexual solicitation; explicit sexual services advertisements; or sexually explicit content involving minors.</p>
          <p>Age estimation is not intended to make prohibited pornography acceptable. Adult age classification does not override InPlayer&apos;s prohibition on explicit sexual content.</p>
        </Section>

        {/* 10. AGE ESTIMATION AND CHILD SAFETY */}
        <Section id="age-estimation" title="10. AGE ESTIMATION AND CHILD SAFETY">
          <p>InPlayer may use face-based age-estimation technology to help determine an approximate age category.</p>
          <p>The purpose is to help the Platform provide a safer and more age-appropriate experience. For example: a child may receive child-appropriate recommendations; a teenager may receive age-appropriate content; an adult may receive content intended for adults where such content is otherwise permitted by InPlayer policy.</p>
          <p>The system is intended as a safety mechanism and is not guaranteed to be completely accurate. Users must not attempt to manipulate, deceive or bypass the age-estimation system.</p>
        </Section>

        {/* 11. FACE-SCAN PRIVACY */}
        <Section id="face-privacy" title="11. FACE-SCAN PRIVACY">
          <p>The face scan is intended for age-estimation and safety purposes.</p>
          <p className="font-semibold text-emerald-400 light:text-emerald-700">
            InPlayer&apos;s stated design is not to maintain a permanent facial-recognition database from the age-estimation scan.
          </p>
          <p>The face image/video used for age estimation is intended not to be permanently retained after the relevant age-estimation process is completed, subject to the technical processing performed by the relevant third-party technology provider.</p>
          <p>The handling of any personal information associated with age estimation is governed by the InPlayer Privacy Policy and applicable Indian data-protection requirements.</p>
        </Section>

        {/* 12. THIRD-PARTY AGE-ESTIMATION TECHNOLOGY */}
        <Section id="third-party-tech" title="12. THIRD-PARTY AGE-ESTIMATION TECHNOLOGY">
          <p>InPlayer may use third-party technology, including technology provided by Google or another service provider, to assist with age estimation.</p>
          <p>Such providers may process technical information necessary to provide the age-estimation service. InPlayer will seek to use such services in accordance with applicable law and applicable contractual/privacy requirements.</p>
        </Section>

        {/* 13. AGE-SUITABLE CONTENT */}
        <Section id="age-suitable" title="13. AGE-SUITABLE CONTENT">
          <p>Creators must consider the likely age of their audience when publishing content.</p>
          <p>Creators must not deliberately design: thumbnails; titles; descriptions; tags; advertisements; or promotional material to attract children to content that is inappropriate or prohibited for children.</p>
          <p>InPlayer may restrict, remove, age-classify or reduce distribution of content where appropriate.</p>
        </Section>

        {/* 14. CHILDREN AND COMMENTS */}
        <Section id="comments" title="14. CHILDREN AND COMMENTS">
          <p>Comments must remain safe and respectful.</p>
          <p>Users must not use comments to: sexually solicit children; groom children; threaten children; bully children; request private contact information; request sexual images; encourage children to meet strangers; manipulate children into leaving the Platform for exploitative purposes; or otherwise endanger a child.</p>
          <p>InPlayer may remove comments and restrict users who violate these rules.</p>
        </Section>

        {/* 15. CHILDREN AND CHAT */}
        <Section id="chat" title="15. CHILDREN AND CHAT">
          <p>Where chat or messaging features are available, users must comply with strict child-safety requirements.</p>
          <p>Users must not use chat to: sexually contact children; groom children; request sexual material; threaten or blackmail children; arrange exploitative meetings; send inappropriate sexual material to children; or encourage children to hide conversations from parents/guardians for exploitative purposes.</p>
          <p>InPlayer may restrict, suspend or disable communication features when necessary for safety.</p>
        </Section>

        {/* 16. PRIVATE COMMUNICATION */}
        <Section id="private-comm" title="16. PRIVATE COMMUNICATION">
          <p>Users should not ask children to provide unnecessary personal information. This may include: home address; school address; private phone number; passwords; financial information; precise location; identity documents; private photographs; or other sensitive information.</p>
          <p>Users must not use personal information to harass, threaten, exploit or manipulate children.</p>
        </Section>

        {/* 17. CHILD HARASSMENT AND BULLYING */}
        <Section id="harassment" title="17. CHILD HARASSMENT AND BULLYING">
          <p>InPlayer prohibits: cyberbullying; threats; targeted harassment; humiliation; repeated abuse; intimidation; blackmail; stalking; and coordinated harassment of children.</p>
          <p>Where appropriate, InPlayer may remove content, restrict accounts or disable relevant communication features.</p>
        </Section>

        {/* 18. CHILD EXPLOITATION FOR COMMERCIAL PURPOSES */}
        <Section id="commercial-exploitation" title="18. CHILD EXPLOITATION FOR COMMERCIAL PURPOSES">
          <p>Users must not exploit children for financial or commercial gain. This includes: sexual exploitation; fraudulent fundraising involving children; deceptive commercial activity targeting children; inappropriate sponsorship targeting children; exploiting children to generate engagement; using children in prohibited advertising; and manipulating children into purchasing products.</p>
        </Section>

        {/* 19. CHILDREN AND MONETIZATION */}
        <Section id="monetization" title="19. CHILDREN AND MONETIZATION">
          <p>Creators are responsible for ensuring that monetized content complies with applicable laws and InPlayer policies.</p>
          <p>Where a child is involved in monetized content, creators must ensure that: the content is lawful; the child is not exploited; the child is not sexually exploited; the child is not used in prohibited commercial activity; applicable permissions/consents are obtained where required; and the content does not violate child-safety standards.</p>
          <p>InPlayer may restrict monetization where child-safety concerns exist.</p>
        </Section>

        {/* 20. CHILDREN AND SPONSORSHIPS */}
        <Section id="sponsorships" title="20. CHILDREN AND SPONSORSHIPS">
          <p>Sponsored content involving or directed toward children must be created responsibly. Creators must not: sexually exploit children in sponsored content; deceive children about commercial relationships; encourage children to engage in dangerous activities; promote prohibited products to children; manipulate children into purchases; or conceal required commercial disclosures.</p>
        </Section>

        {/* 21. CHILDREN AND SHOP FEATURES */}
        <Section id="shop" title="21. CHILDREN AND SHOP FEATURES">
          <p>Creators and sellers must not use InPlayer&apos;s shop functionality to exploit children. Users must not: market prohibited products to children; deceive children about prices or products; request unnecessary personal information from children; encourage unsafe purchases; or use children for fraudulent transactions.</p>
        </Section>

        {/* 22. DANGEROUS CHALLENGES INVOLVING CHILDREN */}
        <Section id="challenges" title="22. DANGEROUS CHALLENGES INVOLVING CHILDREN">
          <p>Content encouraging children to participate in dangerous activities may be removed (dangerous physical challenges, serious injury challenges, dangerous consumption challenges, weapons-related challenges, activities involving serious risk of injury, criminal challenges).</p>
        </Section>

        {/* 23. CHILD SELF-HARM AND SUICIDE CONTENT */}
        <Section id="self-harm" title="23. CHILD SELF-HARM AND SUICIDE CONTENT">
          <p className="font-semibold text-rose-400">
            Users must not encourage or instruct children to: commit suicide; seriously self-harm; participate in dangerous self-harm challenges; or harm another person.
          </p>
        </Section>

        {/* 24. DRUGS AND CHILDREN */}
        <Section id="drugs" title="24. DRUGS AND CHILDREN">
          <p>Users must not encourage children to: purchase illegal drugs; consume illegal drugs; participate in drug distribution; experiment with dangerous substances; or participate in dangerous substance challenges.</p>
        </Section>

        {/* 25. WEAPONS AND CHILDREN */}
        <Section id="weapons" title="25. WEAPONS AND CHILDREN">
          <p>Users must not encourage children to unlawfully acquire, use or misuse weapons.</p>
        </Section>

        {/* 26. CHILD PRIVACY */}
        <Section id="child-privacy" title="26. CHILD PRIVACY">
          <p>InPlayer recognises that children&apos;s personal information requires additional care. InPlayer may collect and process information necessary to: provide the Platform; maintain account security; provide age-appropriate services; protect children; prevent abuse; comply with law; and provide requested features.</p>
          <p>InPlayer will handle applicable personal data according to its Privacy Policy and the applicable Indian data-protection framework.</p>
        </Section>

        {/* 27. CHILD DATA AND CONSENT */}
        <Section id="child-consent" title="27. CHILD DATA AND CONSENT">
          <p>Where applicable law requires additional consent, verification or safeguards for processing a child&apos;s personal data, InPlayer will implement the applicable requirements.</p>
        </Section>

        {/* 28. PARENT AND GUARDIAN ROLE */}
        <Section id="parents" title="28. PARENT AND GUARDIAN ROLE">
          <p>Parents and lawful guardians are encouraged to: supervise children&apos;s use of online services; discuss online safety; use available family controls; review content access; report suspicious behaviour; report exploitation or abuse; and ensure children do not share unnecessary personal information.</p>
        </Section>

        {/* 29. IN-FAMILY */}
        <Section id="in-family" title="29. IN-FAMILY">
          <p>InPlayer may provide the In-Family feature to support family-related functionality. Depending on the features available, In-Family may assist with: family account relationships; age-appropriate content; family safety; parental controls; content preferences; and child-safety settings.</p>
        </Section>

        {/* 30. REPORTING CHILD-SAFETY CONCERNS */}
        <Section id="reporting-concerns" title="30. REPORTING CHILD-SAFETY CONCERNS">
          <p>If you believe a child is being: sexually exploited; groomed; threatened; harassed; blackmailed; exposed to prohibited sexual content; targeted by an adult for exploitation; or otherwise placed at serious risk, you should report the matter immediately through InPlayer&apos;s reporting mechanism.</p>
          <p className="font-semibold text-rose-400">Users should not redistribute suspected illegal child sexual content.</p>
        </Section>

        {/* 31. REPORT BUTTON */}
        <Section id="report-button" title="31. REPORT BUTTON">
          <p>InPlayer provides a Report function. Users may report: Child Safety; Sexual/Adult Content; Grooming; Harassment; Threats; Privacy violation; Illegal content; Scam/Fraud; Copyright; or Other safety concerns.</p>
          <p>Users should provide sufficient information to help InPlayer investigate.</p>
        </Section>

        {/* 32. EMERGENCY AND SERIOUS SAFETY MATTERS */}
        <Section id="emergency" title="32. EMERGENCY AND SERIOUS SAFETY MATTERS">
          <p>Where a report indicates an immediate or serious risk to a child, InPlayer may take urgent protective action, including: removing or restricting content; disabling an account; restricting communications; preserving relevant information; escalating internally; contacting competent authorities; and taking other legally appropriate measures.</p>
        </Section>

        {/* 33. REPORTING TO COMPETENT AUTHORITIES */}
        <Section id="authorities" title="33. REPORTING TO COMPETENT AUTHORITIES">
          <p>Where required or permitted by applicable law, InPlayer may report serious child-safety violations to appropriate governmental, law-enforcement or child-protection authorities.</p>
        </Section>

        {/* 34. MODERATION TECHNOLOGY */}
        <Section id="moderation-tech" title="34. MODERATION TECHNOLOGY">
          <p>InPlayer may use: automated moderation; AI-based detection; age-classification systems; image/video analysis; human moderators; user reports; account signals; and safety systems to identify potential child-safety violations.</p>
        </Section>

        {/* 35. CONTENT REMOVAL */}
        <Section id="removal" title="35. CONTENT REMOVAL">
          <p>InPlayer may remove or restrict content where it reasonably believes the content violates this Policy, harms children, sexually exploits children, violates the Community Guidelines, violates applicable law, or creates a serious child-safety risk.</p>
        </Section>

        {/* 36. ACCOUNT ENFORCEMENT */}
        <Section id="enforcement" title="36. ACCOUNT ENFORCEMENT">
          <p>Depending on the seriousness of the violation, InPlayer may take one or more of the following actions:</p>
          <p className="font-mono text-xs font-semibold text-amber-300 light:text-amber-700">
            Warning → Content Removal → Demonetization → Feature Restriction → Temporary Suspension → Permanent Termination
          </p>
          <p className="font-semibold text-rose-400">
            For severe child-safety violations, InPlayer may skip progressive enforcement and immediately suspend or permanently terminate the account.
          </p>
        </Section>

        {/* 37. CREATOR RESPONSIBILITY */}
        <Section id="creator-resp" title="37. CREATOR RESPONSIBILITY">
          <p>Creators must take reasonable steps to ensure that their content does not sexually exploit children, encourage child exploitation, expose children to prohibited content, facilitate grooming, encourage dangerous conduct, reveal children&apos;s private information, or encourage children to engage in unsafe interactions.</p>
        </Section>

        {/* 38. CHILDREN'S APPEARANCE IN CONTENT */}
        <Section id="appearance" title="38. CHILDREN'S APPEARANCE IN CONTENT">
          <p>The appearance of a child in lawful content does not itself violate this Policy. However, creators must ensure that: the child is not sexually exploited; the child is not presented in a sexually explicit manner; the content does not expose the child to unreasonable danger; privacy and applicable permissions are respected; and the content does not violate any applicable law.</p>
        </Section>

        {/* 39. AI, DEEPFAKES AND CHILD SAFETY */}
        <Section id="ai-deepfakes" title="39. AI, DEEPFAKES AND CHILD SAFETY">
          <p className="font-semibold text-rose-400">Strictly prohibited conduct includes:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>sexual deepfakes involving minors;</li>
            <li>synthetic sexual images of minors;</li>
            <li>AI-generated CSAM;</li>
            <li>sexualisation of children through AI;</li>
            <li>deceptive exploitation of a child&apos;s identity; and</li>
            <li>AI-assisted grooming or exploitation.</li>
          </ul>
          <p>Claims that such content is “AI-generated,” “fake” or “fictional” do not automatically make prohibited child sexual exploitation acceptable.</p>
        </Section>

        {/* 40. CHILD-SAFETY BY DESIGN */}
        <Section id="design" title="40. CHILD-SAFETY BY DESIGN">
          <p>InPlayer may consider child safety when developing: recommendations; search; comments; chat; livestreaming; notifications; advertising; sponsorship; shopping; creator monetization; and age classification.</p>
        </Section>

        {/* 41. ADVERTISING TO CHILDREN */}
        <Section id="advertising" title="41. ADVERTISING TO CHILDREN">
          <p>Advertising and promotional activity involving children must comply with applicable Indian law and InPlayer&apos;s advertising policies. Prohibited or inappropriate advertising may be removed.</p>
        </Section>

        {/* 42. DATA SECURITY */}
        <Section id="data-sec" title="42. DATA SECURITY">
          <p>InPlayer will take reasonable technical and organisational measures to protect personal information. Additional safeguards may be applied where appropriate to information relating to children.</p>
        </Section>

        {/* 43. PRIVACY POLICY */}
        <Section id="privacy-link" title="43. PRIVACY POLICY">
          <p>The collection and processing of personal information, including age-related information and information associated with age-estimation systems, is governed by the InPlayer <Link href="/privacy" className="text-orange-400 hover:underline">Privacy Policy</Link>.</p>
        </Section>

        {/* 44. APPEALS */}
        <Section id="appeals" title="44. APPEALS">
          <p>Where content or an account is restricted or removed, the affected creator/user may use the applicable InPlayer appeal process where available. Serious safety action may remain in effect during review where necessary to protect users.</p>
        </Section>

        {/* 45. FALSE REPORTING */}
        <Section id="false-reporting" title="45. FALSE REPORTING">
          <p>Users must not knowingly submit false child-safety reports to harass creators, remove competitors&apos; content, damage another user&apos;s account, or manipulate Platform moderation.</p>
        </Section>

        {/* 46. NO RETALIATION */}
        <Section id="no-retaliation" title="46. NO RETALIATION">
          <p className="font-semibold text-emerald-400 light:text-emerald-700">InPlayer does not permit retaliation against a person who makes a good-faith child-safety report.</p>
        </Section>

        {/* 47. REPEAT CHILD-SAFETY VIOLATIONS */}
        <Section id="repeat-violations" title="47. REPEAT CHILD-SAFETY VIOLATIONS">
          <p>Repeated violations may result in stronger action, including: permanent demonetization; loss of creator privileges; loss of chat functionality; loss of livestream access; channel suspension; or account termination.</p>
        </Section>

        {/* 48. SERIOUS VIOLATIONS */}
        <Section id="serious-violations" title="48. SERIOUS VIOLATIONS">
          <p className="font-semibold text-rose-400">
            InPlayer may permanently terminate an account immediately for serious violations such as CSAM, child sexual exploitation, grooming, sexual solicitation of minors, trafficking, sexual blackmail, or deliberate creation/distribution of CSAM.
          </p>
        </Section>

        {/* 49. LEGAL COMPLIANCE */}
        <Section id="legal-compliance" title="49. LEGAL COMPLIANCE">
          <p>This Policy operates alongside applicable Indian laws and regulations, including the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and the Digital Personal Data Protection Act, 2023.</p>
        </Section>

        {/* 50. COOPERATION WITH AUTHORITIES */}
        <Section id="authorities-coop" title="50. COOPERATION WITH AUTHORITIES">
          <p>InPlayer may cooperate with competent authorities in matters involving serious child-safety concerns where required or permitted by applicable law.</p>
        </Section>

        {/* 51. UPDATES TO THIS POLICY */}
        <Section id="updates" title="51. UPDATES TO THIS POLICY">
          <p>InPlayer may update this Child Safety Policy from time to time. The latest version will be made available through the InPlayer Platform or website.</p>
        </Section>

        {/* 52. GRIEVANCE OFFICER */}
        <Section id="grievance" title="52. GRIEVANCE OFFICER">
          <p>For child-safety complaints and grievances:</p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">Grievance Officer: Mr. Ramchandra Kushwaha</p>
            <p className="mt-1">Email: <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            <p>Company: Homox Prime Private Limited</p>
            <p>Address: 6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris, Gorwa, Vadodara, Gujarat – 390016, India</p>
          </div>
        </Section>

        {/* 53. CHILD SAFETY CONTACT */}
        <Section id="safety-contact" title="53. CHILD SAFETY CONTACT">
          <p>For urgent child-safety concerns, users should use:</p>
          <p className="font-semibold text-white light:text-slate-900">InPlayer Report function</p>
          <p>or</p>
          <p className="font-semibold text-orange-400">Email: <a href="mailto:support@inplayer.in">support@inplayer.in</a></p>
          <p className="mt-2 text-xs text-slate-400">The report should contain enough information to identify the relevant account, channel, content or interaction. Users should not attach or redistribute suspected illegal child sexual material unless specifically required through a lawful reporting process.</p>
        </Section>

        {/* 54. OUR COMMITMENT */}
        <Section id="commitment" title="54. OUR COMMITMENT">
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm font-semibold text-white light:text-slate-900">
            <p className="font-bold text-rose-400">InPlayer is committed to maintaining a platform where:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300 light:text-slate-700">
              <li>Children are protected.</li>
              <li>Creators are responsible.</li>
              <li>Users are treated with respect.</li>
              <li>Illegal exploitation is not tolerated.</li>
              <li>Safety comes before engagement or revenue.</li>
            </ul>
          </div>
          <p className="mt-6 font-bold uppercase tracking-wider text-orange-400">END OF CHILD SAFETY POLICY</p>
          <p className="text-xs text-slate-500">HOMOX PRIME PRIVATE LIMITED · INPLAYER</p>
        </Section>
      </div>
    </div>
  );
}
