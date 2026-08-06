import type { Metadata } from "next";
import "./amplify-config";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsProvider } from "./components/settings/SettingsProvider";
import AuthProvider from "./components/auth/AuthProvider";
import SiteChrome from "./components/SiteChrome";
import ChunkErrorRecovery from "./components/ChunkErrorRecovery";
import { getPlatformSettings } from "./lib/platformSettings";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "INPLAYER",
  description: "The Future of Entertainment",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetched server-side so MaintenanceGate already knows the real
  // maintenance-mode state in the very first server-rendered HTML, instead
  // of only finding out after its own client-side fetch resolves. That
  // client-only fetch used to mean the real site (navbar, homepage, bottom
  // nav) rendered normally for a brief window on every fresh page load,
  // then got swapped for the maintenance splash once the fetch landed — a
  // flash that's easy to miss on a fast desktop connection but stretches
  // out (and reads as "maintenance mode isn't working") on a slower mobile
  // connection, which is exactly the bug this fixes. getPlatformSettings()
  // already fails open to defaults (maintenance off) on any read error, so
  // this can't accidentally lock real visitors out over a transient issue.
  const { maintenanceMode, maintenanceMessage } = await getPlatformSettings();

  return (
    <html lang="en">
      <body
  className={`
    ${jakarta.className}
    bg-background
    text-foreground
    transition-colors
    duration-300
  `}
>
{/* Applies the correct light/dark class to <html> BEFORE first paint —
    must stay in sync with ThemeProvider.tsx's own resolveTheme() (same
    "inplayer-theme" localStorage key, same 6:00-17:59 local-time daytime
    window). Without this running, <html> carries no theme class until
    ThemeProvider's client-side effect fires after hydration, so every
    page — including the splash screen — briefly renders in the unprefixed
    default (dark) styling and then visibly snaps to light on a
    daytime/light-preference visit. This script was accidentally left
    wrapped in a JSX comment (dead code that never rendered at all), which
    was the actual cause of the dark-then-light flash Reno reported on the
    splash logo — this is a real bug fix, not a re-decoration. */}
<script
  dangerouslySetInnerHTML={{
    __html:
      '(function(){try{var t=localStorage.getItem("inplayer-theme");var r=(t==="light"||t==="dark")?t:((new Date().getHours()>=6&&new Date().getHours()<18)?"light":"dark");document.documentElement.classList.add(r);}catch(e){document.documentElement.classList.add("dark");}})();',
  }}
/>
<ChunkErrorRecovery />
<AuthProvider>
  <SettingsProvider>
    <ThemeProvider>
      <SiteChrome
        initialMaintenanceMode={maintenanceMode}
        initialMaintenanceMessage={maintenanceMessage}
      >
        {children}
      </SiteChrome>
    </ThemeProvider>
  </SettingsProvider>
</AuthProvider>
      </body>
    </html>
  );
}
