import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HamMart — Shop Creator Merchandise & Products Online",
  description: "Discover and buy exclusive creator merchandise, products, and goods safely on HamMart by InPlayer.",
  alternates: {
    canonical: "https://inplayer.in/shop",
  },
};

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
