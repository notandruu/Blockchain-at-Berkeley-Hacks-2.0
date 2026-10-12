import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

const description = "Insurance for a business risk, built from a prediction market contract. Beagle researches the risk, finds a Gemini contract that pays when it happens, and buys the hedge after one approval.";

// The share image is app/opengraph-image.png; metadataBase makes its URL absolute.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://beagle.andrewliu.org"),
  title: "Beagle Insurance",
  description,
  openGraph: { title: "Beagle Insurance", description, url: "/", siteName: "Beagle", type: "website" },
  twitter: { card: "summary_large_image", title: "Beagle Insurance", description },
};

export const viewport: Viewport = { themeColor: "#f8f7f4", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
