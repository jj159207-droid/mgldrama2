import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = { themeColor: "#0d0d14" };

export const metadata: Metadata = {
  title: "Кино сайт",
  description: "Монгол, гадаад, хятад кино үзэх сайт. Нэг дор бүгд.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Кино сайт",
  },
  openGraph: {
    title: "Кино сайт",
    description: "Монгол, гадаад, хятад кино үзэх сайт. Нэг дор бүгд.",
    ...(process.env.SITE_URL ? {url:process.env.SITE_URL} : {}),
    siteName: "Кино сайт",
    images: [
      {
        url: "/cinema-cover.webp",
        width: 1200,
        height: 630,
        alt: "Кино сайт",
      },
    ],
    locale: "mn_MN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Кино сайт",
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
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  regs.forEach(function(reg) { reg.unregister(); });
                });
                caches.keys().then(function(keys) {
                  keys.filter(function(key) { return key.startsWith('mgldrama-'); }).forEach(function(key) { caches.delete(key); });
                });
              } else {
                navigator.serviceWorker.register('/sw.js').catch(function(){});
              }
            });
          }
        `}} />
      </body>
    </html>
  );
}
