import type { Metadata } from "next";
import "./amplify-config";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import MobileBottomNav from "./components/MobileBottomNav";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsProvider } from "./components/settings/SettingsProvider";
import AuthProvider from "./components/auth/AuthProvider";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "INPLAYER",
  description: "The Future of Entertainment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
{/*
<script
  dangerouslySetInnerHTML={{
    __html:
      '(function(){try{var t=localStorage.getItem("inplayer-theme");var r=(t==="light"||t==="dark")?t:((new Date().getHours()>=6&&new Date().getHours()<18)?"light":"dark");document.documentElement.classList.add(r);}catch(e){document.documentElement.classList.add("dark");}})();',
  }}
/>
*/}
<AuthProvider>
  <SettingsProvider>
    <ThemeProvider>
      <Navbar />
      <div className="pb-20 lg:pb-0">{children}</div>
      <Footer />
      <MobileBottomNav />
    </ThemeProvider>
  </SettingsProvider>
</AuthProvider>
      </body>
    </html>
  );
}
