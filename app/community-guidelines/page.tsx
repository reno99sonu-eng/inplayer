import Link from "next/link";
import LegalBackButton from "../components/LegalBackButton";
import LegalNav from "../components/LegalNav";

export const metadata = {
  title: "Community Guidelines — InPlayer",
  description: "Official Community Guidelines of InPlayer operated by Homox Prime Private Limited, establishing safety, conduct, and content standards for creators and users.",
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

export default function CommunityGuidelinesPage() {
  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:py-14">
      <LegalBackButton />
      <div className="mt-4">
        <LegalNav />
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#070D1B] p-6 sm:p-8 light:border-slate-200 light:bg-white shadow-xl">
        <div className="border-b border-white/10 pb-6 light:border-slate-200">
          <span className="inline-block rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-400">
            Platform Conduct Standards
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white light:text-slate-900">
            COMMUNITY GUIDELINES
          </h1>
          <p className="mt-1 text-sm font-semibold text-orange-300 light:text-orange-600">INPLAYER</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400 light:text-slate-600">
            <p><strong>Effective Date:</strong> {EFFECTIVE_DATE}</p>
            <p><strong>Last Updated:</strong> {LAST_UPDATED}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-300 light:text-slate-700">
          <p>
            These Community Guidelines (“Guidelines”) establish the standards that apply to content, creators,
            users, channels, comments, chats, live streams, shops, sponsorships and other activities on the
            InPlayer Platform.
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
            These Guidelines are intended to maintain a safe, respectful and legally compliant environment for
            users of different age groups. These Guidelines should be read together with InPlayer&apos;s{" "}
            <Link href="/terms" className="text-orange-400 hover:underline">Terms &amp; Conditions</Link>,{" "}
            <Link href="/privacy" className="text-orange-400 hover:underline">Privacy Policy</Link>,{" "}
            <Link href="/creator-monetization" className="text-orange-400 hover:underline">Creator Monetization Policy</Link>,{" "}
            <Link href="/copyright" className="text-orange-400 hover:underline">Copyright Policy</Link>, and{" "}
            <Link href="/child-safety" className="text-orange-400 hover:underline">Child Safety Policy</Link>.
          </p>
        </div>

        {/* 1. OUR COMMUNITY STANDARD */}
        <Section id="standard" title="1. OUR COMMUNITY STANDARD">
          <p>InPlayer is an open creator platform where users may create channels and upload lawful content.</p>
          <p>We want InPlayer to be: safe; respectful; family-friendly; creator-friendly; legally compliant; suitable for users of different age groups; and free from unlawful and seriously harmful content.</p>
          <p className="font-semibold text-amber-300 light:text-amber-700">Freedom of expression does not permit content that violates applicable Indian law, the rights of others or these Guidelines.</p>
        </Section>

        {/* 2. ALL-AGE PLATFORM */}
        <Section id="all-age" title="2. ALL-AGE PLATFORM">
          <p>InPlayer is designed as an all-age platform. Creators must therefore take particular care when publishing content that may be accessible to children.</p>
          <p>Content must not be created, uploaded or presented in a manner that exposes children to material that is prohibited or inappropriate for their age.</p>
        </Section>

        {/* 3. ADULT AND EXPLICIT SEXUAL CONTENT */}
        <Section id="sexual-content" title="3. ADULT AND EXPLICIT SEXUAL CONTENT — STRICTLY PROHIBITED">
          <p className="font-semibold text-rose-400">InPlayer does not permit explicit adult sexual content or pornography.</p>
          <p>The following are prohibited: pornography; explicit sexual acts; explicit sexual videos; sexual exploitation; sexual solicitation; sexually explicit material involving minors; sexualised content involving minors; commercial sexual exploitation; sexual services advertisements; sexual trafficking content; explicit nudity intended primarily for sexual gratification; sexual content involving non-consenting persons; non-consensual intimate imagery; sexual blackmail or sextortion; and sexual content depicting or encouraging exploitation.</p>
        </Section>

        {/* 4. MATURE THEMES */}
        <Section id="mature-themes" title="4. MATURE THEMES">
          <p>Content containing mature themes may be restricted depending on its nature (serious crime, disturbing themes, sensitive social issues, mature discussions). Creators must not use thumbnails, titles or descriptions to make otherwise restricted content appear suitable for children.</p>
        </Section>

        {/* 5. NUDITY */}
        <Section id="nudity" title="5. NUDITY">
          <p>Explicit sexual nudity is prohibited. Non-sexual or contextual representations may be reviewed according to the circumstances (educational content, medical information, historical/artistic context, documentary content).</p>
        </Section>

        {/* 6. CHILD SEXUAL EXPLOITATION */}
        <Section id="child-exploitation" title="6. CHILD SEXUAL EXPLOITATION">
          <p className="font-semibold text-rose-400">InPlayer has zero tolerance for child sexual exploitation and abuse.</p>
          <p>Users must never upload CSAM, request or distribute sexual content involving minors, sexualise children, or groom minors. Content involving suspected child sexual exploitation may be removed immediately and reported to competent authorities where required by law.</p>
        </Section>

        {/* 7. VIOLENCE */}
        <Section id="violence" title="7. VIOLENCE">
          <p>Normal fictional violence may be permitted when it is part of legitimate entertainment, storytelling, film, drama, gaming or educational content.</p>
          <p>However, users must not upload or promote content that glorifies real-world violent crime, encourages serious violence, provides instructions for committing serious violent offences, threatens another person, celebrates real-world attacks, or promotes violent criminal organisations.</p>
        </Section>

        {/* 8. THREATS AND INCITEMENT */}
        <Section id="threats" title="8. THREATS AND INCITEMENT">
          <p>Users must not make credible threats of violence against individuals or groups (threats to kill, threats of serious physical harm, calls for violent attacks, encouraging viewers to attack another person, publishing content intended to provoke imminent violence).</p>
        </Section>

        {/* 9. HATE AND DISCRIMINATION */}
        <Section id="hate-speech" title="9. HATE AND DISCRIMINATION">
          <p>InPlayer does not permit content that promotes serious hatred, violence or discrimination against people or groups on prohibited grounds under applicable law.</p>
        </Section>

        {/* 10. HARASSMENT AND BULLYING */}
        <Section id="harassment" title="10. HARASSMENT AND BULLYING">
          <p>Users must not use InPlayer to harass, intimidate or repeatedly target another person (bullying, stalking, threats, targeted humiliation, repeated abusive targeting, sexual harassment, blackmail, extortion, coordinated harassment, publishing personal information to intimidate someone).</p>
        </Section>

        {/* 11. PRIVACY AND PERSONAL INFORMATION */}
        <Section id="privacy" title="11. PRIVACY AND PERSONAL INFORMATION">
          <p>Users must not publish another person&apos;s private information without appropriate authority or lawful basis (home address, private phone number, personal email, financial information, passwords, private documents, identity documents, private communications, precise location). Publishing personal information to threaten, harass, intimidate or harm another person is prohibited.</p>
        </Section>

        {/* 12. IMPERSONATION */}
        <Section id="impersonation" title="12. IMPERSONATION">
          <p>Users must not falsely represent themselves as: another individual, a celebrity, a government official, a company, a creator, an InPlayer employee, a public institution, or another organisation. Fan/parody accounts may be permitted where they are clearly identified and do not deceive users.</p>
        </Section>

        {/* 13. FRAUD, SCAMS AND DECEPTION */}
        <Section id="fraud-scams" title="13. FRAUD, SCAMS AND DECEPTION">
          <p>InPlayer prohibits fraudulent activities. Users must not use the Platform to run scams, conduct phishing, steal credentials, deceive users for money, impersonate financial institutions, promote fraudulent investment schemes, or distribute malware.</p>
        </Section>

        {/* 14. SPAM */}
        <Section id="spam" title="14. SPAM">
          <p>Prohibited spam may include: repetitive unwanted comments; automated posting; fake accounts; mass unsolicited messages; misleading links; engagement manipulation; irrelevant promotional flooding; and repetitive uploads intended to manipulate discovery.</p>
        </Section>

        {/* 15. FAKE ENGAGEMENT */}
        <Section id="fake-engagement" title="15. FAKE ENGAGEMENT">
          <p>Creators must not artificially manipulate Platform metrics (buying fake views, followers, or likes; automated views; bots; click farms; fake engagement networks; misleading traffic). Artificial engagement may result in removal of metrics, demonetization, withholding of earnings, or termination.</p>
        </Section>

        {/* 16. COPYRIGHT AND INTELLECTUAL PROPERTY */}
        <Section id="copyright" title="16. COPYRIGHT AND INTELLECTUAL PROPERTY">
          <p>Creators must upload only content they own, have licensed, have permission to use, or are otherwise legally entitled to publish (see our <Link href="/copyright" className="text-orange-400 hover:underline">Copyright &amp; Intellectual Property Policy</Link>).</p>
        </Section>

        {/* 17. COPYRIGHT STRIKE SYSTEM */}
        <Section id="strike-system" title="17. COPYRIGHT STRIKE SYSTEM">
          <p>InPlayer operates a graduated copyright enforcement system (First violation: content removal, warning, possible monetization restriction; Second violation: additional restrictions, channel strike, feature limits; Third violation: suspension or termination).</p>
        </Section>

        {/* 18. AI-GENERATED AND ALTERED CONTENT */}
        <Section id="ai-content" title="18. AI-GENERATED AND ALTERED CONTENT">
          <p>AI-generated or digitally altered content may be permitted when it does not violate these Guidelines or applicable law. Creators must not use AI to impersonate deceptively, create fake evidence, fabricate harmful events, or create non-consensual sexual media. InPlayer may require labelling of synthetic content.</p>
        </Section>

        {/* 19. NEWS AND MISINFORMATION */}
        <Section id="misinformation" title="19. NEWS AND MISINFORMATION">
          <p>Users must not deliberately publish deceptive information intended to cause serious harm, fraud or unlawful activity (fake government notices, fake emergency alerts, fabricated public-safety info, manipulated evidence, fake financial claims).</p>
        </Section>

        {/* 20. POLITICAL CONTENT */}
        <Section id="political" title="20. POLITICAL CONTENT">
          <p>Political discussion and lawful political expression may be permitted. Users must comply with applicable Indian election, advertising and other laws.</p>
        </Section>

        {/* 21. DRUGS */}
        <Section id="drugs" title="21. DRUGS">
          <p>Content that promotes, sells or facilitates illegal drugs is prohibited.</p>
        </Section>

        {/* 22. ALCOHOL AND TOBACCO */}
        <Section id="alcohol" title="22. ALCOHOL AND TOBACCO">
          <p>Lawful discussion, educational material, news and fictional depiction may be permitted subject to applicable law. Users must not use InPlayer to unlawfully sell, distribute or promote restricted products.</p>
        </Section>

        {/* 23. GAMBLING AND BETTING */}
        <Section id="gambling" title="23. GAMBLING AND BETTING">
          <p>Users must not use InPlayer to facilitate illegal gambling, betting or wagering.</p>
        </Section>

        {/* 24. TERRORISM AND EXTREMIST CONTENT */}
        <Section id="terrorism" title="24. TERRORISM AND EXTREMIST CONTENT">
          <p>Users must not upload or promote content that recruits for terrorist organisations, provides operational support, promotes terrorist violence, or facilitates terrorist financing.</p>
        </Section>

        {/* 25. DANGEROUS ACTIVITIES */}
        <Section id="dangerous" title="25. DANGEROUS ACTIVITIES">
          <p>Users must not promote content that encourages serious and immediate harm (dangerous challenges involving serious injury, instructions for serious crimes, weapon misuse, deliberate poisoning).</p>
        </Section>

        {/* 26. WEAPONS */}
        <Section id="weapons" title="26. WEAPONS">
          <p>Users must not use InPlayer to unlawfully sell prohibited weapons, facilitate illegal weapons transactions, or threaten others with weapons.</p>
        </Section>

        {/* 27. SELF-HARM AND SUICIDE */}
        <Section id="self-harm" title="27. SELF-HARM AND SUICIDE">
          <p className="font-semibold text-rose-400">InPlayer does not permit content that encourages or instructs users to seriously harm themselves or commit suicide.</p>
        </Section>

        {/* 28. SEXUAL HARASSMENT AND NON-CONSENSUAL CONTENT */}
        <Section id="sexual-harassment" title="28. SEXUAL HARASSMENT AND NON-CONSENSUAL CONTENT">
          <p>Users must not publish: intimate images without consent; sexual recordings without consent; sexual blackmail; sextortion; private sexual communications; or threats to distribute intimate material. Such content may be removed immediately and may result in permanent termination.</p>
        </Section>

        {/* 29. MINORS AND CONTACT */}
        <Section id="minors-contact" title="29. MINORS AND CONTACT">
          <p>Users must not use InPlayer to facilitate inappropriate or exploitative contact with minors (see <Link href="/child-safety" className="text-orange-400 hover:underline">Child Safety Policy</Link>).</p>
        </Section>

        {/* 30. THUMBNAILS, TITLES AND DESCRIPTIONS */}
        <Section id="thumbnails" title="30. THUMBNAILS, TITLES AND DESCRIPTIONS">
          <p>Creators are responsible for thumbnails, titles, descriptions, tags, captions, and promotional images. Creators must not use misleading metadata to attract children to inappropriate content, disguise prohibited content, or promote scams.</p>
        </Section>

        {/* 31. COMMENTS AND CHAT */}
        <Section id="comments" title="31. COMMENTS AND CHAT">
          <p>Comments, live chats and messaging must remain safe and respectful. Users must not use chat/comments for harassment, threats, hate, spam, scams, sexual solicitation, child grooming, doxxing, malware, or impersonation.</p>
        </Section>

        {/* 32. LIVE STREAMING */}
        <Section id="livestream" title="32. LIVE STREAMING">
          <p>Live-streaming users are responsible for content broadcast through their streams. InPlayer may interrupt, restrict or terminate a live stream if it contains serious illegal activity, prohibited sexual content, child-safety violations, credible threats, or extreme violence.</p>
        </Section>

        {/* 33. SPONSORSHIP AND PAID PROMOTION */}
        <Section id="sponsorship" title="33. SPONSORSHIP AND PAID PROMOTION">
          <p>Creators participating in sponsorships must provide truthful, transparent disclosures in compliance with applicable Indian advertising guidelines and platform policies.</p>
        </Section>

        {/* 34. SHOP AND SELLER CONTENT */}
        <Section id="shop" title="34. SHOP AND SELLER CONTENT">
          <p>Sellers must only list products/services they are legally authorised to sell, and must comply with consumer-protection and tax requirements (see <Link href="/hammart-vendor-terms" className="text-orange-400 hover:underline">HamMart Vendor Terms</Link>).</p>
        </Section>

        {/* 35. PLATFORM MANIPULATION */}
        <Section id="platform-manipulation" title="35. PLATFORM MANIPULATION">
          <p>Users must not attempt to manipulate InPlayer&apos;s recommendation system, search, trending algorithms, monetization system, creator rankings, or reporting mechanisms.</p>
        </Section>

        {/* 36. MALWARE AND CYBER ABUSE */}
        <Section id="malware" title="36. MALWARE AND CYBER ABUSE">
          <p>Users must not upload or distribute viruses, malware, ransomware, spyware, malicious scripts, phishing pages, or credential-stealing tools.</p>
        </Section>

        {/* 37. ILLEGAL CONTENT */}
        <Section id="illegal-content" title="37. ILLEGAL CONTENT">
          <p>Any content that violates applicable Indian law may be removed or restricted. InPlayer may cooperate with competent authorities where legally required.</p>
        </Section>

        {/* 38. CONTENT REPORTING */}
        <Section id="reporting" title="38. CONTENT REPORTING">
          <p>Users can report content that they believe violates these Guidelines. Report categories include: Child Safety, Sexual/Adult Content, Violence, Hate, Harassment, Copyright, Privacy, Spam, Scam/Fraud, Illegal Activity, Impersonation, Dangerous Content, and Other.</p>
        </Section>

        {/* 39. MODERATION */}
        <Section id="moderation" title="39. MODERATION">
          <p>InPlayer may use a combination of automated technology, artificial intelligence, human moderators, user reports, creator reports, technical signals, and legal notices to identify potential violations.</p>
        </Section>

        {/* 40. ENFORCEMENT ACTIONS */}
        <Section id="enforcement-actions" title="40. ENFORCEMENT ACTIONS">
          <p>Depending on severity and circumstances, InPlayer may: issue a warning; remove content; restrict visibility; age-restrict content; disable comments; restrict live streaming; restrict uploads; demonetize content; withhold invalid earnings; restrict creator features; temporarily suspend an account; or permanently terminate an account.</p>
        </Section>

        {/* 41. SEVERE VIOLATIONS */}
        <Section id="severe-violations" title="41. SEVERE VIOLATIONS">
          <p className="font-semibold text-rose-400">
            Certain violations may result in immediate suspension or permanent termination without a graduated warning system (child sexual exploitation, terrorism, credible threats of violence, major cyberattacks, severe harassment, non-consensual imagery, deliberate platform manipulation).
          </p>
        </Section>

        {/* 42. APPEALS */}
        <Section id="appeals" title="42. APPEALS">
          <p>Where an appeal mechanism is available, users may appeal certain moderation decisions by providing account details, affected content, reason for appeal, and supporting documentation.</p>
        </Section>

        {/* 43. REPEAT VIOLATIONS */}
        <Section id="repeat-violations" title="43. REPEAT VIOLATIONS">
          <p>Repeated violations may result in progressively stronger enforcement, up to permanent account termination.</p>
        </Section>

        {/* 44. CREATOR RESPONSIBILITY */}
        <Section id="creator-responsibility" title="44. CREATOR RESPONSIBILITY">
          <p>Creators are responsible for their channels and content. Creators should review content before publishing, use accurate metadata, respect copyright, protect minors, and moderate their communities.</p>
        </Section>

        {/* 45. AGE-SAFETY SYSTEM */}
        <Section id="age-safety" title="45. AGE-SAFETY SYSTEM">
          <p>InPlayer may use age estimation and safety technologies to determine an approximate age category for content recommendations. Creators must not intentionally design content or metadata to bypass age-safety mechanisms.</p>
        </Section>

        {/* 46. NO GUARANTEE OF PERMANENT ACCESS */}
        <Section id="no-guarantee" title="46. NO GUARANTEE OF PERMANENT ACCESS">
          <p>Content that is permitted today may become restricted or removed later because of changes in law, new safety risks, new platform policies, or third-party claims.</p>
        </Section>

        {/* 47. LEGAL COMPLIANCE */}
        <Section id="compliance" title="47. LEGAL COMPLIANCE">
          <p>These Guidelines operate alongside applicable laws and regulations of India. Where a conflict exists between these Guidelines and a mandatory legal requirement, the mandatory legal requirement will prevail.</p>
        </Section>

        {/* 48. REPORTING TO AUTHORITIES */}
        <Section id="authorities" title="48. REPORTING TO AUTHORITIES">
          <p>Where required by applicable law, InPlayer may report or provide information relating to serious unlawful activity to appropriate governmental or law-enforcement authorities.</p>
        </Section>

        {/* 49. CHANGES TO COMMUNITY GUIDELINES */}
        <Section id="changes" title="49. CHANGES TO COMMUNITY GUIDELINES">
          <p>InPlayer may update these Guidelines from time to time. The latest version will be made available through the Platform or website.</p>
        </Section>

        {/* 50. CONTACT AND GRIEVANCE */}
        <Section id="grievance" title="50. CONTACT AND GRIEVANCE">
          <p>For complaints or concerns regarding content, safety or these Guidelines:</p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">Grievance Officer: Mr. Ramchandra Kushwaha</p>
            <p className="mt-1">Email: <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            <p>Company: Homox Prime Private Limited</p>
            <p>Address: 6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris, Gorwa, Vadodara, Gujarat – 390016, India</p>
          </div>
        </Section>

        {/* 51. FINAL COMMUNITY STANDARD */}
        <Section id="final-standard" title="51. FINAL COMMUNITY STANDARD">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-5 text-sm font-semibold text-white light:text-slate-900">
            <p className="text-base text-cyan-400 font-bold">
              “Create. Share. Watch. Connect. Earn — but do so safely, lawfully and respectfully.”
            </p>
            <p className="mt-2 text-slate-300 light:text-slate-700">
              Users should ask themselves before uploading:
              <br />
              <em>“Is this content legal, respectful, safe for the intended audience, and something I have the right to publish?”</em>
            </p>
            <p className="mt-1 text-slate-300 light:text-slate-700">If the answer is no, the content should not be uploaded.</p>
          </div>
          <p className="mt-6 font-bold uppercase tracking-wider text-orange-400">END OF COMMUNITY GUIDELINES</p>
          <p className="text-xs text-slate-500">HOMOX PRIME PRIVATE LIMITED · INPLAYER</p>
        </Section>
      </div>
    </div>
  );
}
