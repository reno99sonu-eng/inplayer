import type { Metadata } from "next";

import { Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";
import MobileBottomNav from "./components/MobileBottomNav";
import { ThemeProvider } from "./components/ThemeProvider";

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
        <ThemeProvider>
          <div className="pb-20 lg:pb-0">{children}</div>
          <MobileBottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
