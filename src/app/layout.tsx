import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/context/ToastContext";
import { BrandingProvider } from "@/context/BrandingContext";
import PendingPaymentFloat from "@/components/PendingPaymentFloat";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0c0c0c",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Online Shop - Game Item Store",
    template: "%s | Online Shop",
  },
  description: "Online Shop - a game-item store with instant delivery and QRIS payments.",
  keywords: [
    "jual script lua gtps",
    "script lua gtps",
    "script lua gtpscloud",
    "lua script gtpscloud",
    "toko script gtps",
    "gtps lua scripting",
    "growtopia private server script",
    "script growtopia private server",
    "lua growtopia",
    "gtps script murah",
    "beli script lua gtps",
    "gtpscloud lua",
    "GTShop",
  ],
  authors: [{ name: "Online Shop" }],
  creator: "Online Shop",
  publisher: "Online Shop",
  openGraph: {
    title: "Online Shop - Game Item Store",
    description: "Toko script Lua untuk GTPS dan GTPSCloud. Download instan setelah pembayaran QRIS.",
    type: "website",
    siteName: "Online Shop",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "Online Shop - Game Item Store",
    description: "Toko script Lua untuk GTPS dan GTPSCloud. Download instan.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Online Shop",
              url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
              description:
                "Toko script Lua untuk GTPS dan GTPSCloud — Growtopia private server.",
              sameAs: [],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Online Shop",
              url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
              inLanguage: "id",
            }),
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ToastProvider>
          <BrandingProvider>
            {children}
            <PendingPaymentFloat />
          </BrandingProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
