import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./chat.css";
import "./install.css";

export const viewport: Viewport = { themeColor: "#090d13" };

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
        {children}
        <Script src="/install.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
