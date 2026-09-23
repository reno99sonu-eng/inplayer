// Shared section heading used across every policy document — previously
// duplicated identically in app/privacy/page.tsx, app/terms/page.tsx, and
// app/hammart-vendor-terms/page.tsx. Pulled out once so the InPlayer
// Policies hub (app/policies/page.tsx) and its per-policy section
// components all render numbered sections identically.
export default function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-black text-white light:text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-slate-300 light:text-slate-700">
        {children}
      </div>
    </section>
  );
}
