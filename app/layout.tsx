import type { Metadata, Viewport } from "next";
import Script from "next/script";
import AgeGate from "@/app/components/AgeGate";
import CinematicHeroMount from "@/app/components/CinematicHeroMount";
import CatalogCardTuning from "@/app/components/CatalogCardTuning";
import "./globals.css";
import "./chat.css";
import "./install.css";
import "./appearance.css";
import "./cinematic3d.css";
import "./hero-carousel.css";
import "./hero-carousel-tuning.css";
import "./payment-cleanup.css";
import "./catalog-card-tuning.css";
import "./catalog-trailer-tuning.css";
import "./film-price-blink.css";
import "./film-reference.css";
import "./wallet.css";

export const viewport: Viewport = { themeColor: "#05070c" };

export const metadata: Metadata = {
  title: "ТАЗА САЙТ",
  description: "Монгол, гадаад, хятад кино үзэх сайт. Нэг дор бүгд.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ТАЗА САЙТ",
  },
  openGraph: {
    title: "ТАЗА САЙТ",
    description: "Монгол, гадаад, хятад кино үзэх сайт. Нэг дор бүгд.",
    ...(process.env.SITE_URL ? {url:process.env.SITE_URL} : {}),
    siteName: "ТАЗА САЙТ",
    images: [
      {
        url: "/cinema-cover.webp",
        width: 1200,
        height: 630,
        alt: "ТАЗА САЙТ",
      },
    ],
    locale: "mn_MN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ТАЗА САЙТ",
    description: "Монгол, гадаад, хятад кино үзэх сайт. Нэг дор бүгд.",
    images: ["/cinema-cover.webp"],
  },
  ...(process.env.SITE_URL ? {metadataBase:new URL(process.env.SITE_URL)} : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="mn"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <AgeGate>
          {children}
          <CinematicHeroMount />
          <CatalogCardTuning />
        </AgeGate>
        <Script src="/install.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
