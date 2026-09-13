import Link from "next/link";
import LegalBackButton from "../components/LegalBackButton";
import LegalNav from "../components/LegalNav";
import CopyrightHubClient from "./CopyrightHubClient";

export const metadata = {
  title: "Copyright & Intellectual Property Policy — InPlayer",
  description: "Official Copyright and Intellectual Property Policy of InPlayer operated by Homox Prime Private Limited, in accordance with the Indian Copyright Act, 1957.",
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

export default function CopyrightPolicyPage() {
  const policyCard = (
    <div className="rounded-2xl border border-white/10 bg-[#070D1B] p-6 sm:p-8 light:border-slate-200 light:bg-white shadow-xl">
        <div className="border-b border-white/10 pb-6 light:border-slate-200">
          <span className="inline-block rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-orange-400">
            Intellectual Property Framework
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white light:text-slate-900">
            COPYRIGHT &amp; INTELLECTUAL PROPERTY POLICY
          </h1>
          <p className="mt-1 text-sm font-semibold text-orange-300 light:text-orange-600">INPLAYER</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400 light:text-slate-600">
            <p><strong>Effective Date:</strong> {EFFECTIVE_DATE}</p>
            <p><strong>Last Updated:</strong> {LAST_UPDATED}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-300 light:text-slate-700">
          <p>
            This Copyright &amp; Intellectual Property Policy (“Copyright Policy”) explains how InPlayer handles
            copyright and other intellectual-property rights on its Platform.
          </p>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">HOMOX PRIME PRIVATE LIMITED</p>
            <p className="mt-1">6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris,</p>
            <p>Gorwa, Vadodara, Gujarat – 390016, India</p>
            <p className="mt-1"><strong>GSTIN:</strong> 24AAICH1282J1ZK</p>
            <p><strong>Website:</strong> <a href="https://www.inplayer.in" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">www.inplayer.in</a></p>
            <p><strong>Support:</strong> <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            <p><strong>General Email:</strong> <a href="mailto:homoxprimepvtltd@gmail.com" className="text-orange-400 hover:underline">homoxprimepvtltd@gmail.com</a></p>
          </div>

          <p>
            This Policy forms part of InPlayer&apos;s <Link href="/terms" className="text-orange-400 hover:underline">Terms &amp; Conditions</Link> and{" "}
            <Link href="/community-guidelines" className="text-orange-400 hover:underline">Community Guidelines</Link>.
          </p>
        </div>

        {/* 1. PURPOSE OF THIS POLICY */}
        <Section id="purpose" title="1. PURPOSE OF THIS POLICY">
          <p>InPlayer respects copyright and other intellectual-property rights.</p>
          <p>InPlayer is an open creator platform that allows eligible users to: create channels, upload videos, publish content, share creative works, participate in monetization, use sponsorship features, and use other creator services.</p>
          <p className="font-semibold text-emerald-400 light:text-emerald-700">Creators must upload only content that they own or are legally authorised to use.</p>
          <p>This Policy establishes the procedures for: copyright complaints; content review; removal; copyright strikes; appeals; counter-notices; restoration; repeat infringement; and account enforcement.</p>
        </Section>

        {/* 2. COPYRIGHT LAW */}
        <Section id="copyright-law" title="2. COPYRIGHT LAW">
          <p>Copyright protection may apply to original works including: films; web series; videos; music; sound recordings; photographs; graphics; artwork; written works; software; animations; broadcasts; thumbnails; logos; and other eligible creative works.</p>
          <p className="font-semibold text-white light:text-slate-900">
            Users are responsible for complying with applicable Indian copyright law, including the Copyright Act, 1957, as amended from time to time.
          </p>
        </Section>

        {/* 3. CREATOR RESPONSIBILITY */}
        <Section id="creator-responsibility" title="3. CREATOR RESPONSIBILITY">
          <p>Before uploading content, every creator must ensure that they:</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>own the content; or</li>
            <li>have obtained a valid licence or permission; or</li>
            <li>have another lawful basis to use the content.</li>
          </ol>
          <p>Creators are responsible for obtaining necessary rights relating to: video footage, music, sound recordings, lyrics, photographs, artwork, logos, trademarks, performances, third-party clips, screen recordings, scripts, subtitles, voice recordings, and other copyrighted material.</p>
        </Section>

        {/* 4. PROHIBITED COPYRIGHT INFRINGEMENT */}
        <Section id="prohibited-infringement" title="4. PROHIBITED COPYRIGHT INFRINGEMENT">
          <p>Creators must not upload or distribute unauthorised copies of:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>movies;</li>
            <li>web series;</li>
            <li>television programmes;</li>
            <li>OTT content;</li>
            <li>paid streaming content;</li>
            <li>music albums;</li>
            <li>songs;</li>
            <li>music videos;</li>
            <li>sports broadcasts;</li>
            <li>paid courses;</li>
            <li>books;</li>
            <li>audiobooks;</li>
            <li>other creators&apos; videos;</li>
            <li>premium content;</li>
            <li>leaked content;</li>
            <li>pirated content;</li>
            <li>stolen content; or</li>
            <li>any other copyrighted material without appropriate rights.</li>
          </ul>
        </Section>

        {/* 5. UNAUTHORISED RE-UPLOADS */}
        <Section id="re-uploads" title="5. UNAUTHORISED RE-UPLOADS">
          <p>Creators must not simply download and re-upload another person&apos;s content.</p>
          <p>Examples include: downloading another creator&apos;s video and uploading it; copying YouTube videos; copying Instagram/Reels content; copying movies; copying OTT shows; uploading leaked films; uploading copyrighted music without permission.</p>
          <p className="font-semibold text-amber-300 light:text-amber-700">
            Giving credit to the original creator does not automatically provide copyright permission.
          </p>
        </Section>

        {/* 6. MUSIC AND AUDIO */}
        <Section id="music-audio" title="6. MUSIC AND AUDIO">
          <p>Creators are responsible for ensuring that they have rights to all music and audio used in their videos.</p>
          <p>This includes: background music, songs, sound effects, recordings, remixes, DJ mixes, lyrics, and instrumental recordings.</p>
          <p className="font-semibold text-rose-400">
            A creator may not rely solely on statements such as: “No copyright infringement intended.”
          </p>
          <p>Such a statement does not automatically create a legal right to use copyrighted material.</p>
        </Section>

        {/* 7. THUMBNAILS, IMAGES AND GRAPHICS */}
        <Section id="thumbnails" title="7. THUMBNAILS, IMAGES AND GRAPHICS">
          <p>Copyright rules also apply to: thumbnails, posters, photographs, illustrations, artwork, promotional graphics, screenshots, and logos.</p>
          <p>Creators should use only material they own or are authorised to use.</p>
        </Section>

        {/* 8. FAIR DEALING / LEGAL EXCEPTIONS */}
        <Section id="fair-dealing" title="8. FAIR DEALING / LEGAL EXCEPTIONS">
          <p>Certain uses of copyrighted works may be permitted under applicable law.</p>
          <p>Examples may include certain lawful uses for: criticism, review, reporting current events, research, education, and other statutory exceptions under Section 52 of the Copyright Act, 1957.</p>
          <p>Whether a particular use qualifies for an exception depends on the facts and applicable law. InPlayer does not make a legal determination for creators. Creators remain responsible for ensuring that their use of third-party material is lawful.</p>
        </Section>

        {/* 9. COPYRIGHT COMPLAINTS */}
        <Section id="complaints" title="9. COPYRIGHT COMPLAINTS">
          <p>A copyright owner or authorised representative may submit a complaint if they believe content on InPlayer infringes their copyright.</p>
          <p>Complaints may be submitted through:</p>
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
              <p className="font-bold text-white light:text-slate-900">Option 1 — In-App / On-Platform Report</p>
              <p className="mt-1">Use the “Report Copyright” option available on the relevant content, where provided.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
              <p className="font-bold text-white light:text-slate-900">Option 2 — Email</p>
              <p className="mt-1">Send the complaint directly to our copyright grievance team: <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            </div>
          </div>
        </Section>

        {/* 10. INFORMATION REQUIRED FOR A COPYRIGHT COMPLAINT */}
        <Section id="complaint-info" title="10. INFORMATION REQUIRED FOR A COPYRIGHT COMPLAINT">
          <p>To help InPlayer review a complaint, the rights holder should provide:</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>full name;</li>
            <li>contact email;</li>
            <li>telephone number, where appropriate;</li>
            <li>identification of the copyrighted work;</li>
            <li>explanation of ownership or authority;</li>
            <li>identification of the allegedly infringing content;</li>
            <li>URL or sufficient information to locate the content;</li>
            <li>explanation of why the content is allegedly infringing;</li>
            <li>good-faith statement;</li>
            <li>accuracy/authority declaration; and</li>
            <li>electronic signature or other valid confirmation.</li>
          </ol>
          <p>InPlayer may request additional information where necessary.</p>
        </Section>

        {/* 11. GOOD-FAITH DECLARATION */}
        <Section id="good-faith" title="11. GOOD-FAITH DECLARATION">
          <p>A copyright complainant should confirm that, to the best of their knowledge:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>the complaint is made in good faith;</li>
            <li>the identified use is not authorised by the rights holder, its agent or applicable law;</li>
            <li>the information provided is accurate; and</li>
            <li>the complainant is authorised to act on behalf of the rights holder where applicable.</li>
          </ul>
        </Section>

        {/* 12. FALSE COPYRIGHT CLAIMS */}
        <Section id="false-claims" title="12. FALSE COPYRIGHT CLAIMS">
          <p>Copyright complaints must not be knowingly false, misleading or malicious.</p>
          <p>A person who repeatedly submits fraudulent copyright complaints may have their reporting privileges restricted. InPlayer may take appropriate action where complaints are abused.</p>
        </Section>

        {/* 13. INITIAL REVIEW */}
        <Section id="initial-review" title="13. INITIAL REVIEW">
          <p>After receiving a copyright complaint, InPlayer may review: the reported content; ownership information; the complaint; available account information; creator information; relevant Platform records; applicable law; and other relevant circumstances.</p>
          <p>InPlayer may request additional information from either party.</p>
        </Section>

        {/* 14. CONTENT REMOVAL */}
        <Section id="content-removal" title="14. CONTENT REMOVAL">
          <p>Where InPlayer determines that content violates applicable copyright requirements or Platform policy, it may: remove the content; restrict access; disable monetization; restrict distribution; issue a copyright strike; restrict creator features; or take other appropriate action.</p>
          <p>Where legally required, InPlayer may act upon a valid legal notice or order.</p>
        </Section>

        {/* 15. COPYRIGHT STRIKE SYSTEM */}
        <Section id="strike-system" title="15. COPYRIGHT STRIKE SYSTEM">
          <p>InPlayer may use a graduated three-strike system.</p>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs">
              <h4 className="font-bold text-amber-300 light:text-amber-700">FIRST COPYRIGHT STRIKE</h4>
              <p className="mt-1">Possible actions: removal of infringing content; warning; copyright strike; temporary monetization restriction where appropriate.</p>
            </div>
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-xs">
              <h4 className="font-bold text-orange-300 light:text-orange-700">SECOND COPYRIGHT STRIKE</h4>
              <p className="mt-1">Possible actions: removal of infringing content; additional copyright strike; demonetization; feature restrictions; upload restrictions; temporary channel limitations.</p>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs">
              <h4 className="font-bold text-rose-300 light:text-rose-700">THIRD COPYRIGHT STRIKE</h4>
              <p className="mt-1">Possible actions: removal of infringing content; suspension; permanent termination of the channel/account.</p>
            </div>
          </div>
        </Section>

        {/* 16. SERIOUS INFRINGEMENT */}
        <Section id="serious-infringement" title="16. SERIOUS INFRINGEMENT">
          <p>InPlayer may take stronger action without following the full three-strike sequence where the circumstances are serious.</p>
          <p>Examples may include: large-scale piracy; repeated commercial infringement; leaked unreleased films; systematic copyright theft; organised infringement; deliberate monetization of stolen content; repeated infringement after warnings; infringement involving serious legal proceedings.</p>
          <p className="font-semibold text-rose-400">Possible action includes immediate: content removal; demonetization; feature restriction; suspension; or permanent termination.</p>
        </Section>

        {/* 17. REPEAT INFRINGERS */}
        <Section id="repeat-infringers" title="17. REPEAT INFRINGERS">
          <p>Creators who repeatedly infringe copyright may lose access to Platform features, including monetization, uploads, livestreaming, shop, sponsorship, creator tools, channel creation, or the entire InPlayer account.</p>
        </Section>

        {/* 18. MONETIZATION AND COPYRIGHT */}
        <Section id="monetization-copyright" title="18. MONETIZATION AND COPYRIGHT">
          <p className="font-semibold text-white light:text-slate-900">Creators must not earn money from content they are not legally entitled to monetize.</p>
          <p>If content is identified as infringing, InPlayer may: disable monetization; suspend monetization; withhold invalid earnings; reverse invalid revenue attribution; adjust creator earnings; or take other action permitted by applicable law and Platform policy.</p>
        </Section>

        {/* 19. COPYRIGHT APPEAL */}
        <Section id="appeal" title="19. COPYRIGHT APPEAL">
          <p>If a creator believes that their content was incorrectly removed or restricted, they may use the applicable InPlayer appeal mechanism.</p>
          <p>An appeal may include: creator details; affected content; explanation; proof of ownership; licence/permission; and other supporting documentation.</p>
          <p>InPlayer may review the appeal and may restore content where appropriate.</p>
        </Section>

        {/* 20. COUNTER-NOTICE */}
        <Section id="counter-notice" title="20. COUNTER-NOTICE">
          <p>Where legally applicable, a creator may submit a counter-notice stating that the removal was incorrect or that the creator has the necessary rights or lawful basis.</p>
          <p>A counter-notice should contain sufficient information to identify: the removed content; the creator; the relevant copyright complaint; the basis for the objection; ownership/licensing evidence where applicable; and a valid electronic confirmation/signature.</p>
          <p>InPlayer may request additional information before taking further action.</p>
        </Section>

        {/* 21. RIGHTS HOLDER AND CREATOR DISPUTES */}
        <Section id="disputes" title="21. RIGHTS HOLDER AND CREATOR DISPUTES">
          <p>InPlayer generally does not act as a court or final legal decision-maker regarding complex ownership disputes.</p>
          <p>Where ownership is genuinely disputed, InPlayer may: maintain the restriction; request additional documentation; direct parties to resolve the dispute; comply with a valid court/government order; or take other action permitted by law.</p>
        </Section>

        {/* 22. CONTENT RESTORATION */}
        <Section id="restoration" title="22. CONTENT RESTORATION">
          <p>Where content was removed or restricted incorrectly, or where a valid appeal/counter-notice is accepted, InPlayer may restore the content.</p>
          <p>Restoration may not be possible where: another legal restriction applies; the content violates another Platform policy; the account has been terminated for another reason; a valid legal order requires continued restriction; or the content presents another safety risk.</p>
        </Section>

        {/* 23. COPYRIGHT DOES NOT OVERRIDE OTHER POLICIES */}
        <Section id="other-policies" title="23. COPYRIGHT DOES NOT OVERRIDE OTHER POLICIES">
          <p>A creator may have copyright ownership over content but still violate other InPlayer policies (Child Safety Policy, Community Guidelines, adult-content restrictions, harassment rules, illegal-content rules, or advertising rules).</p>
          <p className="font-semibold text-amber-300 light:text-amber-700">Copyright ownership does not create an automatic right to publish prohibited content.</p>
        </Section>

        {/* 24. AI-GENERATED CONTENT */}
        <Section id="ai-content" title="24. AI-GENERATED CONTENT">
          <p>AI-generated or AI-assisted content must comply with applicable copyright law and these Guidelines.</p>
          <p>Creators must not use AI to: reproduce copyrighted content without lawful rights; imitate protected works unlawfully; distribute unauthorised copies; create deceptive replicas of copyrighted material; or remove or conceal copyright ownership information unlawfully.</p>
        </Section>

        {/* 25. PUBLIC DOMAIN AND LICENSED CONTENT */}
        <Section id="public-domain" title="25. PUBLIC DOMAIN AND LICENSED CONTENT">
          <p>Content in the public domain or content used under a valid licence may be uploaded where otherwise permitted. Creators should maintain evidence of licences, permissions, assignments, or public-domain status.</p>
        </Section>

        {/* 26. CREATIVE COMMONS AND THIRD-PARTY LICENCES */}
        <Section id="creative-commons" title="26. CREATIVE COMMONS AND THIRD-PARTY LICENCES">
          <p>Creators using Creative Commons or other licensed material must comply with the applicable licence conditions (attribution, non-commercial restrictions, share-alike, etc.). Failure to comply with licence conditions may result in infringement.</p>
        </Section>

        {/* 27. TRADEMARKS AND BRAND RIGHTS */}
        <Section id="trademarks" title="27. TRADEMARKS AND BRAND RIGHTS">
          <p>Copyright is not the only intellectual-property right protected on InPlayer. Users must not unlawfully misuse trademarks, logos, brand identities, trade names, or service marks. Impersonation and deceptive use of another brand are prohibited.</p>
        </Section>

        {/* 28. PERSONALITY / PUBLICITY RIGHTS */}
        <Section id="publicity-rights" title="28. PERSONALITY / PUBLICITY RIGHTS">
          <p>Users should not unlawfully exploit another person&apos;s name, image, voice, likeness, or identity. Creators should obtain appropriate permissions where required, especially for commercial use.</p>
        </Section>

        {/* 29. OWNERSHIP OF INPLAYER MATERIAL */}
        <Section id="inplayer-ownership" title="29. OWNERSHIP OF INPLAYER MATERIAL">
          <p>The InPlayer application, software, interface, branding, logos, graphics, technology and other proprietary material are owned by or licensed to Homox Prime Private Limited. Users may not reproduce or commercially exploit InPlayer proprietary material without permission.</p>
        </Section>

        {/* 30. CREATOR LICENCE TO INPLAYER */}
        <Section id="creator-licence" title="30. CREATOR LICENCE TO INPLAYER">
          <p className="font-semibold text-emerald-400 light:text-emerald-700">Uploading content does not transfer ownership of the creator&apos;s copyright to InPlayer.</p>
          <p>However, as described in the Terms &amp; Conditions, the creator grants InPlayer the necessary operational licence to host, store, encode, reproduce, stream, display, communicate, distribute, technically process, recommend, promote within the Platform, and otherwise operate the content through InPlayer.</p>
        </Section>

        {/* 31. DELETED CONTENT */}
        <Section id="deleted-content" title="31. DELETED CONTENT">
          <p>If a creator deletes content, InPlayer may retain certain copies or related information where reasonably necessary for legal compliance, copyright disputes, security, fraud prevention, backups, accounting, dispute resolution, or other legitimate purposes. Such retention does not mean that the content remains publicly available.</p>
        </Section>

        {/* 32. COPYRIGHT REPORTING ABUSE */}
        <Section id="reporting-abuse" title="32. COPYRIGHT REPORTING ABUSE">
          <p>Users must not misuse the copyright reporting system to harass another creator, remove lawful competition, silence criticism, interfere with another creator&apos;s business, or repeatedly submit false complaints.</p>
        </Section>

        {/* 33. LEGAL NOTICES */}
        <Section id="legal-notices" title="33. LEGAL NOTICES">
          <p>InPlayer may respond to valid legal notices, court orders, governmental directions and other legally enforceable requests concerning intellectual property.</p>
        </Section>

        {/* 34. COPYRIGHT CONTACT */}
        <Section id="contact" title="34. COPYRIGHT CONTACT">
          <p>Copyright complaints and related notices may be submitted to:</p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">Email: <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            <p className="mt-1">Company: Homox Prime Private Limited</p>
            <p>Address: 6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris, Gorwa, Vadodara, Gujarat – 390016, India</p>
          </div>
        </Section>

        {/* 35. GRIEVANCE OFFICER */}
        <Section id="grievance" title="35. GRIEVANCE OFFICER">
          <p>For copyright-related grievances and complaints:</p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">Grievance Officer: Mr. Ramchandra Kushwaha</p>
            <p className="mt-1">Email: <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            <p>Address: 6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris, Gorwa, Vadodara, Gujarat – 390016, India</p>
          </div>
        </Section>

        {/* 36. COPYRIGHT POLICY AND INDIAN LAW */}
        <Section id="indian-law" title="36. COPYRIGHT POLICY AND INDIAN LAW">
          <p>This Policy is intended to operate in accordance with applicable Indian intellectual-property laws, including the Copyright Act, 1957, as amended from time to time.</p>
          <p>Nothing in this Policy limits any mandatory rights or legal remedies available under Indian law.</p>
        </Section>

        {/* 37. CHANGES TO THIS POLICY */}
        <Section id="changes" title="37. CHANGES TO THIS POLICY">
          <p>InPlayer may update this Copyright Policy from time to time. The latest version will be made available through InPlayer or www.inplayer.in.</p>
        </Section>

        {/* 38. FINAL COPYRIGHT PRINCIPLE */}
        <Section id="final-principle" title="38. FINAL COPYRIGHT PRINCIPLE">
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-5 text-sm font-semibold text-white light:text-slate-900">
            <p className="text-base text-orange-400 font-bold">
              “If you did not create it, own it, license it or otherwise have the legal right to use it, do not upload it to InPlayer.”
            </p>
            <p className="mt-2 text-slate-300 light:text-slate-700">Giving credit is not a substitute for permission.</p>
            <p className="mt-1 text-slate-300 light:text-slate-700">Creators are responsible for ensuring that their uploads comply with copyright and other applicable intellectual-property laws.</p>
          </div>
          <p className="mt-6 font-bold uppercase tracking-wider text-orange-400">END OF COPYRIGHT &amp; INTELLECTUAL PROPERTY POLICY</p>
          <p className="text-xs text-slate-500">HOMOX PRIME PRIVATE LIMITED · INPLAYER</p>
        </Section>
      </div>
  );

  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:py-14">
      <LegalBackButton />
      <div className="mt-4">
        <LegalNav />
      </div>

      <div className="mt-6">
        <CopyrightHubClient policyContent={policyCard} />
      </div>
    </div>
  );
}
