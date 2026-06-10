import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "21 кино 18 kino — Кино үзэх сайт",
  description: "Монгол, гадаад, хятад кино үзэх сайт. Нэг дор бүгд.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MGL Drama",
  },
  themeColor: "#0d0d14",
  openGraph: {
    title: "21 кино 18 kino — Кино үзэх сайт",
    description: "Монгол, гадаад, хятад кино үзэх сайт. Нэг дор бүгд.",
    url: "https://mongolz.pro",
    siteName: "Mongolz.pro",
    images: [
      {
        url: "https://i.ibb.co/9mDWgp40/mongolz-og-banner-v5.jpg",
        width: 1200,
        height: 630,
        alt: "21 кино 18 kino — Кино үзэх сайт",
      },
    ],
    locale: "mn_MN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "21 кино 18 kino — Кино үзэх сайт",
    description: "Монгол, гадаад, хятад кино үзэх сайт. Нэг дор бүгд.",
    images: ["https://i.ibb.co/9mDWgp40/mongolz-og-banner-v5.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="mn"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function(){});
            });
          }
        `}} />
      </body>
    </html>
  );
}
