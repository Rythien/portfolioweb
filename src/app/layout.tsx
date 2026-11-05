import type { Metadata, Viewport } from "next";
import { Newsreader, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CustomCursor from "@/components/common/CustomCursor";
import ThemeSync from "@/components/chrome/ThemeSync";
import GridOverlay from "@/components/chrome/GridOverlay";
import { SITE_DATA } from "@/content/site";

const newsreader = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
  adjustFontFallback: true,
});

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

export const viewport: Viewport = {
  themeColor: "#E9E7E2",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://searonmaharjan.com"),
  title: `${SITE_DATA.brand.name} — ${SITE_DATA.brand.role}`,
  description: `${SITE_DATA.brand.tagline} Portfolio of ${SITE_DATA.brand.name}, based in ${SITE_DATA.brand.city}, ${SITE_DATA.brand.country}.`,
  authors: [{ name: SITE_DATA.brand.name }],
  creator: SITE_DATA.brand.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://searonmaharjan.com",
    title: `${SITE_DATA.brand.name} — ${SITE_DATA.brand.role}`,
    description: `${SITE_DATA.brand.tagline} Portfolio of ${SITE_DATA.brand.name}, based in ${SITE_DATA.brand.city}, ${SITE_DATA.brand.country}.`,
    siteName: `${SITE_DATA.brand.name} Portfolio`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_DATA.brand.name} — ${SITE_DATA.brand.role}`,
    description: `${SITE_DATA.brand.tagline} Portfolio of ${SITE_DATA.brand.name}, based in ${SITE_DATA.brand.city}, ${SITE_DATA.brand.country}.`,
  },
};

const personStructuredData = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE_DATA.brand.name,
  jobTitle: SITE_DATA.brand.role,
  description: `${SITE_DATA.brand.tagline} Web & Interactive Designer and Creative Developer based in ${SITE_DATA.brand.city}, ${SITE_DATA.brand.country}.`,
  address: {
    "@type": "PostalAddress",
    addressLocality: SITE_DATA.brand.city,
    addressCountry: "NP",
  },
  alumniOf: {
    "@type": "EducationalOrganization",
    name: "Asia e University",
  },
  url: "https://searonmaharjan.com",
  sameAs: [
    "https://github.com/rythien",
    "https://linkedin.com/in/searon-maharjan",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-mode="wake"
      className={`${newsreader.variable} ${geist.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(personStructuredData),
          }}
        />
      </head>
      <body suppressHydrationWarning className="font-[family-name:var(--font-sans)] bg-surface text-ink min-h-screen selection:bg-ink selection:text-surface">
        <ThemeSync />
        <CustomCursor />
        <GridOverlay />
        {children}
      </body>
    </html>
  );
}
