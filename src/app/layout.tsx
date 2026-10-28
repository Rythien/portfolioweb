import type { Metadata, Viewport } from "next";
import { Syne, Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Searon Maharjan — Creative Developer & Frontend Architect",
  description:
    "Personal portfolio of Searon Maharjan, a Creative Developer and Frontend Architect based in Kathmandu, Nepal (27.71°N · 85.32°E). Specializing in WebGL, realtime graphics, and high-performance editorial interfaces.",
  keywords: [
    "Searon Maharjan",
    "Creative Developer",
    "Frontend Architect",
    "WebGL",
    "GSAP",
    "Kathmandu",
    "Nepal",
    "Editorial Web Design",
    "Interactive Portfolio",
  ],
  authors: [{ name: "Searon Maharjan", url: "https://searonmaharjan.com" }],
  creator: "Searon Maharjan",
  metadataBase: new URL("https://searonmaharjan.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://searonmaharjan.com",
    title: "Searon Maharjan — Creative Developer & Frontend Architect",
    description:
      "Bespoke creative development, realtime WebGL shaders, and high-precision digital architecture rooted in Kathmandu Valley heritage.",
    siteName: "Searon Maharjan Portfolio",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Searon Maharjan — Creative Developer & Frontend Architect",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Searon Maharjan — Creative Developer & Frontend Architect",
    description:
      "Creative Developer & Frontend Architect based in Kathmandu, Nepal. Crafting dark, technical, editorial experiences.",
    creator: "@searonm",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Searon Maharjan",
    jobTitle: "Creative Developer & Frontend Architect",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Kathmandu",
      addressCountry: "Nepal",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "27.7172",
      longitude: "85.3240",
    },
    url: "https://searonmaharjan.com",
    sameAs: [
      "https://github.com/searonm",
      "https://linkedin.com/in/searon-maharjan",
      "https://instagram.com/searon.m",
    ],
    knowsAbout: [
      "Creative Development",
      "WebGL & Shaders",
      "Frontend Architecture",
      "GSAP Motion Systems",
      "Design Systems",
    ],
  };

  return (
    <html
      lang="en"
      className={`${syne.variable} ${geist.variable} ${jetbrainsMono.variable} antialiased selection:bg-[var(--accent)] selection:text-white`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-[family-name:var(--font-geist)] bg-[var(--bg-void)] text-[var(--text-primary)] min-h-screen">
        {children}
      </body>
    </html>
  );
}
