import BackButton from "@/app/components/BackButton";
import ChannelPageContent from "@/app/components/ChannelPageContent";
import { getPublicProfile } from "@/app/lib/getPublicProfile";

export const dynamic = "force-dynamic";

interface ChannelPageProps {
  params: Promise<{ username: string }>;
}

// Server-rendered — this used to be a "use client" page that always
// started from a loading spinner while it fetched its own data client-
// side, even for a signed-out visitor who never needed auth at all. Now
// the profile is resolved here, server-side, ANONYMOUSLY (viewerId: null
// — a Server Component has no Authorization header to read a Cognito
// token from), and handed straight to ChannelPageContent as real,
// server-rendered HTML on the very first paint. A signed-in visitor's own
// authenticated view (isOwner, connections-gated unlocking) is upgraded
// client-side inside ChannelPageContent — see that file's top comment.
export default async function ChannelPage({ params }: ChannelPageProps) {
  const { username } = await params;
  const result = await getPublicProfile(username, null);

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-8 sm:py-12">
        <BackButton />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-semibold text-white light:text-slate-900">
            No channel at @{username}
          </p>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
            Double-check the username and try again.
          </p>
        </div>
      </div>
    );
  }

  // Keyed on username so navigating from one channel to another (which
  // re-runs this Server Component and produces a fresh initialProfile)
  // fully remounts the client content below — every bit of local state
  // (sort, search, visible count, the authenticated-upgrade fetch) resets
  // cleanly instead of needing its own manual reset effect.
  return <ChannelPageContent key={username} username={username} initialProfile={result.data} />;
}
