import Link from "next/link";
import LegalBackButton from "../components/LegalBackButton";
import LegalNav from "../components/LegalNav";

export const metadata = {
  title: "Creator Monetization Policy — InPlayer",
  description: "Official Creator Monetization Policy of InPlayer operated by Homox Prime Private Limited, covering KYC eligibility, revenue programs, and compliance requirements in India.",
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

export default function CreatorMonetizationPage() {
  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:py-14">
      <LegalBackButton />
      <div className="mt-4">
        <LegalNav />
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#070D1B] p-6 sm:p-8 light:border-slate-200 light:bg-white shadow-xl">
        <div className="border-b border-white/10 pb-6 light:border-slate-200">
          <span className="inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
            Creator Partner Program
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white light:text-slate-900">
            CREATOR MONETIZATION POLICY
          </h1>
          <p className="mt-1 text-sm font-semibold text-orange-300 light:text-orange-600">INPLAYER</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400 light:text-slate-600">
            <p><strong>Effective Date:</strong> {EFFECTIVE_DATE}</p>
            <p><strong>Last Updated:</strong> {LAST_UPDATED}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-300 light:text-slate-700">
          <p>
            This Creator Monetization Policy (“Policy”) explains the eligibility requirements, verification process,
            monetization rules, creator earnings, KYC requirements, rewards, restrictions, and termination
            conditions applicable to creators using the InPlayer platform.
          </p>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">HOMOX PRIME PRIVATE LIMITED</p>
            <p className="mt-1">6th Floor, 615, Shivanta Highstreet, Panchavati Canal Road, Near Shivanta Iris,</p>
            <p>Gorwa, Vadodara, Gujarat – 390016, India</p>
            <p className="mt-1"><strong>GSTIN:</strong> 24AAICH1282J1ZK</p>
            <p><strong>Website:</strong> <a href="https://www.inplayer.in" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">www.inplayer.in</a></p>
            <p><strong>Support Email:</strong> <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
            <p><strong>General Email:</strong> <a href="mailto:homoxprimepvtltd@gmail.com" className="text-orange-400 hover:underline">homoxprimepvtltd@gmail.com</a></p>
          </div>

          <p>
            By participating in monetization, the Creator agrees to comply with this Policy, the InPlayer{" "}
            <Link href="/terms" className="text-orange-400 hover:underline">Terms &amp; Conditions</Link>,{" "}
            <Link href="/community-guidelines" className="text-orange-400 hover:underline">Community Guidelines</Link>,{" "}
            <Link href="/privacy" className="text-orange-400 hover:underline">Privacy Policy</Link>,{" "}
            <Link href="/child-safety" className="text-orange-400 hover:underline">Child Safety Policy</Link>,{" "}
            <Link href="/copyright" className="text-orange-400 hover:underline">Copyright &amp; Intellectual Property Policy</Link>, and all applicable laws and regulations in India.
          </p>
        </div>

        {/* 1. PURPOSE */}
        <Section id="purpose" title="1. PURPOSE">
          <p>This Creator Monetization Policy explains the eligibility requirements, verification process, monetization rules, creator earnings, KYC requirements, rewards, restrictions, and termination conditions applicable to creators using the InPlayer platform.</p>
          <p>InPlayer allows eligible creators to create channels, upload original content, build an audience, and, subject to applicable eligibility requirements, participate in InPlayer&apos;s monetization programme.</p>
        </Section>

        {/* 2. DEFINITIONS */}
        <Section id="definitions" title="2. DEFINITIONS">
          <ul className="list-disc space-y-2 pl-5">
            <li><strong className="text-white light:text-slate-900">2.1 “InPlayer”:</strong> Means the video and creator platform operated by HOMOX PRIME PRIVATE LIMITED.</li>
            <li><strong className="text-white light:text-slate-900">2.2 “Creator”:</strong> Means an individual, entity, channel owner, or other permitted user who uploads or publishes content on InPlayer.</li>
            <li><strong className="text-white light:text-slate-900">2.3 “In-Family”:</strong> Means the follower/community connection metric used by InPlayer for creators. In-Family may be used as one of the eligibility criteria for creator verification and rewards.</li>
            <li><strong className="text-white light:text-slate-900">2.4 “Views”:</strong> Means valid views of eligible content as measured and recorded by InPlayer&apos;s systems.</li>
            <li><strong className="text-white light:text-slate-900">2.5 “KYC”:</strong> Means Know Your Customer verification and may include identity, tax, banking, payment, address, or other information reasonably required by InPlayer or its payment/KYC service providers.</li>
            <li><strong className="text-white light:text-slate-900">2.6 “Verified Channel”:</strong> Means a creator channel that has successfully completed the verification process prescribed by InPlayer.</li>
            <li><strong className="text-white light:text-slate-900">2.7 “Monetized Channel”:</strong> Means a Verified Channel that has been approved to participate in the InPlayer monetization programme.</li>
          </ul>
        </Section>

        {/* 3. ELIGIBILITY FOR KYC */}
        <Section id="eligibility" title="3. ELIGIBILITY FOR KYC">
          <p>A Creator may become eligible to receive the KYC option after satisfying the following minimum platform thresholds:</p>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            <p className="font-bold text-emerald-400">Minimum Platform Thresholds:</p>
            <p className="mt-1 text-base font-extrabold text-white light:text-slate-900">
              500 In-Family + 50,000 valid views
            </p>
            <p className="mt-2 text-xs text-slate-300 light:text-slate-600">
              Once the Creator reaches both thresholds, InPlayer may make the KYC/monetization application option available to the Creator.
            </p>
          </div>
          <p className="font-semibold text-amber-300 light:text-amber-700">
            Meeting these thresholds does not automatically guarantee monetization.
          </p>
          <p>InPlayer may review the Creator&apos;s account, content, activity, engagement quality, policy compliance, and other relevant factors before approving the Creator.</p>
        </Section>

        {/* 4. KYC PROCESS */}
        <Section id="kyc" title="4. KYC PROCESS">
          <p>After becoming eligible, the Creator may be asked to complete KYC through the process provided by InPlayer. Depending on the Creator and applicable requirements, KYC may include:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Full legal name;</li>
            <li>Date of birth;</li>
            <li>Government-issued identity information;</li>
            <li>PAN or other tax identification;</li>
            <li>Aadhaar or other legally permitted identity document;</li>
            <li>Address information;</li>
            <li>Bank account details;</li>
            <li>UPI/payment information;</li>
            <li>GST information, where applicable; and</li>
            <li>Business/entity information, where applicable.</li>
          </ul>
          <p>The Creator must provide accurate, complete, current, and authentic information. Providing false or fraudulent information may result in rejection of KYC, suspension of monetization, or termination.</p>
        </Section>

        {/* 5. CHANNEL VERIFICATION */}
        <Section id="verification" title="5. CHANNEL VERIFICATION">
          <p>After successful completion and approval of KYC, InPlayer may verify the Creator&apos;s channel. A channel may be treated as a Verified Channel only after InPlayer confirms that:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>The required eligibility thresholds have been met;</li>
            <li>KYC information has been successfully verified;</li>
            <li>The Creator has complied with applicable InPlayer policies;</li>
            <li>No material fraud, manipulation, or serious policy violation has been identified; and</li>
            <li>Any additional verification requirements imposed by InPlayer have been satisfied.</li>
          </ol>
          <p>KYC completion alone does not create an automatic right to verification.</p>
        </Section>

        {/* 6. START OF MONETIZATION */}
        <Section id="start" title="6. START OF MONETIZATION">
          <p className="font-semibold text-white light:text-slate-900">
            Creator monetization will begin only after the Creator&apos;s channel has been successfully verified and approved for monetization by InPlayer.
          </p>
          <p>Simply reaching 500 In-Family + 50,000 views does not itself activate earnings. The Creator must first complete the applicable KYC and verification process. After approval, eligible content may participate in the available monetization programmes.</p>
        </Section>

        {/* 7. CREATOR EARNINGS */}
        <Section id="earnings" title="7. CREATOR EARNINGS">
          <p>InPlayer may provide creators with earning opportunities through monetization mechanisms made available on the platform from time to time (Advertising revenue, platform monetization programmes, sponsorship or brand collaboration opportunities).</p>
          <p className="font-semibold text-rose-400">
            InPlayer does not guarantee any fixed minimum income, number of views, revenue amount, or earning level to any Creator.
          </p>
        </Section>

        {/* 8. VALID VIEWS AND ENGAGEMENT */}
        <Section id="valid-views" title="8. VALID VIEWS AND ENGAGEMENT">
          <p>For monetization purposes, InPlayer may determine which views, impressions, interactions, and other engagement activities qualify as valid.</p>
          <p>InPlayer may exclude or disregard: artificial views, bot-generated views, automated traffic, purchased views, fake engagement, click manipulation, or traffic generated through prohibited methods.</p>
        </Section>

        {/* 9. PROHIBITED MONETIZATION ACTIVITIES */}
        <Section id="prohibited-monetization" title="9. PROHIBITED MONETIZATION ACTIVITIES">
          <p>A Creator must not use the InPlayer monetization programme to earn money through: copyright-infringing content; unauthorized reuploads; stolen videos; fraudulent schemes; fake engagement; explicit pornography; child sexual exploitation; illegal activities; or malware.</p>
        </Section>

        {/* 10. COPYRIGHT AND MONETIZATION */}
        <Section id="copyright-monetization" title="10. COPYRIGHT AND MONETIZATION">
          <p>Creators must have the necessary rights, licences, permissions, or legal basis to monetize the content they upload.</p>
          <p>A Creator must not monetize movies owned by another party without authorization, television programmes without permission, music without required rights, or reuploaded content.</p>
        </Section>

        {/* 11. THREE-STRIKE COPYRIGHT SYSTEM */}
        <Section id="strikes" title="11. THREE-STRIKE COPYRIGHT SYSTEM">
          <p>InPlayer may apply a three-strike system for repeated copyright violations (First Violation: removal, warning, strike, monetization restriction; Second Violation: removal, additional strike, demonetization; Third Violation: removal, suspension, termination).</p>
        </Section>

        {/* 12. COMMUNITY GUIDELINES AND MONETIZATION */}
        <Section id="community-monetization" title="12. COMMUNITY GUIDELINES AND MONETIZATION">
          <p>A Creator must comply with the InPlayer Community Guidelines.</p>
          <p className="font-semibold text-amber-300 light:text-amber-700">
            Content availability and monetization eligibility are separate decisions.
          </p>
          <p>InPlayer may allow content to remain available but demonetize it, restrict advertising on specific content, or suspend monetization temporarily.</p>
        </Section>

        {/* 13. CHILD AND MINOR CREATORS */}
        <Section id="minor-creators" title="13. CHILD AND MINOR CREATORS">
          <p>InPlayer is an all-age platform; however, monetization and financial payouts may require additional legal, KYC, contractual, tax, or guardian requirements. Where required by law, a minor Creator may need involvement, consent, or verification by a parent or lawful guardian.</p>
        </Section>

        {/* 14. 10,000 IN-FAMILY CREATOR GIFT */}
        <Section id="gift-reward" title="14. 10,000 IN-FAMILY CREATOR GIFT">
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-sm">
            <p className="font-bold text-violet-400">Creator Recognition Programme:</p>
            <p className="mt-1 text-base font-extrabold text-white light:text-slate-900">
              10,000 In-Family Recognition Milestone
            </p>
            <p className="mt-1 text-xs text-slate-300 light:text-slate-600">
              A Creator who reaches 10,000 In-Family may become eligible to receive a gift or reward from InPlayer in recognition of audience growth and community contribution.
            </p>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Conditions: legitimate account, genuine growth, no artificial engagement, no serious policy violations. The gift is a recognition reward and should not automatically be treated as cash compensation or guaranteed monetary income.
          </p>
        </Section>

        {/* 15. PAYOUTS */}
        <Section id="payouts" title="15. PAYOUTS">
          <p>Where a Creator becomes eligible for monetary payouts, payments may be made through payment methods supported by InPlayer. The Creator may be required to provide verified bank account details, UPI ID, PAN, and GST details.</p>
          <p>Payments are subject to verification, processing schedules, tax deductions, fraud checks, refunds, chargebacks, and minimum payout thresholds.</p>
        </Section>

        {/* 16. TAXES AND STATUTORY DEDUCTIONS */}
        <Section id="taxes" title="16. TAXES AND STATUTORY DEDUCTIONS">
          <p>Creators are responsible for complying with their applicable tax obligations. Where required by Indian law, InPlayer or its payment partners may deduct or withhold applicable taxes (TDS), collect PAN/GST, and report information to relevant authorities.</p>
        </Section>

        {/* 17. EARNINGS ADJUSTMENTS */}
        <Section id="adjustments" title="17. EARNINGS ADJUSTMENTS">
          <p>InPlayer may adjust or recalculate earnings where it identifies invalid traffic, fraudulent activity, fake engagement, chargebacks, refunds, or payment/technical errors.</p>
        </Section>

        {/* 18. SPONSORSHIP AND BRAND DEALS */}
        <Section id="sponsorship" title="18. SPONSORSHIP AND BRAND DEALS">
          <p>Creators participating in sponsorships must clearly disclose sponsored or paid promotional content, make no deceptive claims, and comply with Indian advertising regulations.</p>
        </Section>

        {/* 19. SHOP AND CREATOR COMMERCE */}
        <Section id="shop" title="19. SHOP AND CREATOR COMMERCE">
          <p>Where InPlayer provides shop or commerce functionality, creators and sellers must comply with the applicable <Link href="/hammart-vendor-terms" className="text-orange-400 hover:underline">HamMart Vendor Terms</Link> and not promote counterfeit, unsafe, or restricted goods.</p>
        </Section>

        {/* 20. ACCOUNT SECURITY */}
        <Section id="security" title="20. ACCOUNT SECURITY">
          <p>Creators are responsible for maintaining the security of their InPlayer account. Selling or transferring monetized channels without authorization is prohibited.</p>
        </Section>

        {/* 21. MONETIZATION SUSPENSION */}
        <Section id="suspension" title="21. MONETIZATION SUSPENSION">
          <p>InPlayer may temporarily suspend monetization for suspected fraud, invalid traffic, pending KYC, copyright concerns, serious policy violations, or payment disputes.</p>
        </Section>

        {/* 22. DEMONETIZATION */}
        <Section id="demonetization" title="22. DEMONETIZATION">
          <p>InPlayer may demonetize individual content (where a specific video does not qualify) or an entire channel (for repeated violations or serious misconduct).</p>
        </Section>

        {/* 23. SUSPENSION OR TERMINATION */}
        <Section id="termination" title="23. SUSPENSION OR TERMINATION">
          <p>InPlayer may suspend or permanently terminate a Creator&apos;s account in accordance with its Terms &amp; Conditions and applicable policies.</p>
        </Section>

        {/* 24. PENDING EARNINGS AFTER TERMINATION */}
        <Section id="pending-earnings" title="24. PENDING EARNINGS AFTER TERMINATION">
          <p>If an account is suspended or terminated, InPlayer may review pending earnings before releasing any payment. Amounts associated with fraud, invalid traffic, copyright infringement, or illegal activity may be withheld or cancelled.</p>
        </Section>

        {/* 25. NO GUARANTEE OF EARNINGS */}
        <Section id="no-guarantee" title="25. NO GUARANTEE OF EARNINGS">
          <p className="font-semibold text-rose-400">
            Participation in the InPlayer monetization programme does not guarantee that a Creator will earn money.
          </p>
          <p>InPlayer does not guarantee a specific income, RPM, CPM, number of advertisements, sponsorship amount, or monthly payment.</p>
        </Section>

        {/* 26. CHANGES TO MONETIZATION PROGRAMME */}
        <Section id="changes" title="26. CHANGES TO MONETIZATION PROGRAMME">
          <p>InPlayer may modify its monetization programme, eligibility requirements, verification processes, payout thresholds, and revenue calculations from time to time.</p>
        </Section>

        {/* 27. REPORTING AND FRAUD PREVENTION */}
        <Section id="reporting" title="27. REPORTING AND FRAUD PREVENTION">
          <p>Users may report suspected fake views, fake In-Family, bot activity, monetization fraud, copyright infringement, or scam activity.</p>
        </Section>

        {/* 28. APPEALS */}
        <Section id="appeals" title="28. APPEALS">
          <p>Where monetization is suspended, content is demonetized, or enforcement action is taken, the Creator may have an opportunity to appeal with supporting documentation.</p>
        </Section>

        {/* 29. GRIEVANCE OFFICER */}
        <Section id="grievance" title="29. GRIEVANCE OFFICER">
          <p>For grievances relating to this Policy or platform decisions:</p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs light:border-slate-200 light:bg-slate-50">
            <p className="font-bold text-white light:text-slate-900">Grievance Officer: Mr. Ramchandra Kushwaha</p>
            <p className="mt-1">Email: <a href="mailto:support@inplayer.in" className="text-orange-400 hover:underline">support@inplayer.in</a></p>
          </div>
        </Section>

        {/* 30. CREATOR RESPONSIBILITY */}
        <Section id="creator-resp" title="30. CREATOR RESPONSIBILITY">
          <p>The Creator remains responsible for: the legality of uploaded content; ownership or licensing of content; accuracy of KYC information; tax compliance; advertising compliance; authenticity of audience engagement; and account security.</p>
        </Section>

        {/* 31. INTELLECTUAL PROPERTY */}
        <Section id="ip" title="31. INTELLECTUAL PROPERTY">
          <p className="font-semibold text-emerald-400 light:text-emerald-700">Creators retain ownership of their original intellectual property, subject to operational licences granted to InPlayer.</p>
        </Section>

        {/* 32. COMPLIANCE WITH INDIAN LAW */}
        <Section id="indian-law" title="32. COMPLIANCE WITH INDIAN LAW">
          <p>Creators participating in monetization must comply with all applicable laws and regulations of India.</p>
        </Section>

        {/* 33. POLICY INTERPRETATION */}
        <Section id="interpretation" title="33. POLICY INTERPRETATION">
          <p>This Policy should be read together with InPlayer Terms &amp; Conditions, Privacy Policy, Community Guidelines, Child Safety Policy, Copyright Policy, Advertising Policy, and Shop/Seller Policy.</p>
        </Section>

        {/* 34. GOVERNING LAW AND JURISDICTION */}
        <Section id="governing-law" title="34. GOVERNING LAW AND JURISDICTION">
          <p className="font-semibold text-white light:text-slate-900">
            This Policy shall be governed by the laws of India. Courts having jurisdiction in Vadodara, Gujarat, India shall have jurisdiction over disputes.
          </p>
        </Section>

        {/* 35. CONTACT & SUMMARY TABLE */}
        <Section id="summary-table" title="35. CREATOR MONETIZATION ELIGIBILITY — QUICK SUMMARY">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 light:text-slate-700 border-collapse border border-white/10 light:border-slate-200">
              <thead className="bg-white/5 text-white light:bg-slate-100 light:text-slate-900 font-bold">
                <tr>
                  <th className="p-2.5 border border-white/10 light:border-slate-200 w-16">Stage</th>
                  <th className="p-2.5 border border-white/10 light:border-slate-200">Requirement / Action</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-2.5 border border-white/10 light:border-slate-200 font-bold">1</td><td className="p-2.5 border border-white/10 light:border-slate-200">Creator creates an InPlayer channel</td></tr>
                <tr><td className="p-2.5 border border-white/10 light:border-slate-200 font-bold">2</td><td className="p-2.5 border border-white/10 light:border-slate-200">Creator builds genuine audience and views</td></tr>
                <tr className="bg-emerald-500/10"><td className="p-2.5 border border-white/10 light:border-slate-200 font-bold text-emerald-400">3</td><td className="p-2.5 border border-white/10 light:border-slate-200 font-bold text-emerald-400">500 In-Family + 50,000 valid views completed</td></tr>
                <tr><td className="p-2.5 border border-white/10 light:border-slate-200 font-bold">4</td><td className="p-2.5 border border-white/10 light:border-slate-200">KYC option becomes available, subject to InPlayer review</td></tr>
                <tr><td className="p-2.5 border border-white/10 light:border-slate-200 font-bold">5</td><td className="p-2.5 border border-white/10 light:border-slate-200">Creator completes KYC</td></tr>
                <tr><td className="p-2.5 border border-white/10 light:border-slate-200 font-bold">6</td><td className="p-2.5 border border-white/10 light:border-slate-200">InPlayer reviews and verifies the channel</td></tr>
                <tr><td className="p-2.5 border border-white/10 light:border-slate-200 font-bold">7</td><td className="p-2.5 border border-white/10 light:border-slate-200">Verified Channel → Monetization may start</td></tr>
                <tr><td className="p-2.5 border border-white/10 light:border-slate-200 font-bold">8</td><td className="p-2.5 border border-white/10 light:border-slate-200">Creator earns according to applicable monetization programme</td></tr>
                <tr className="bg-violet-500/10"><td className="p-2.5 border border-white/10 light:border-slate-200 font-bold text-violet-400">9</td><td className="p-2.5 border border-white/10 light:border-slate-200 font-bold text-violet-400">10,000 In-Family → Eligible for InPlayer gift/reward, subject to verification and policy compliance</td></tr>
                <tr><td className="p-2.5 border border-white/10 light:border-slate-200 font-bold">10</td><td className="p-2.5 border border-white/10 light:border-slate-200">Continued compliance is required to remain monetized</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-6 font-bold uppercase tracking-wider text-orange-400">END OF CREATOR MONETIZATION POLICY</p>
          <p className="text-xs text-slate-500">HOMOX PRIME PRIVATE LIMITED · INPLAYER</p>
        </Section>
      </div>
    </div>
  );
}
