import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "../styles/globals.css";
import RecaptchaProvider from "../components/RecaptchaProvider";
import { getAdminDb } from "../lib/firebaseAdmin";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const FALLBACK_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://inan.com.ng';

export async function generateMetadata(): Promise<Metadata> {
  let siteUrl = FALLBACK_URL;
  let siteName = 'Inan Feedback';
  let description = 'Collect, manage and analyse guest feedback across all Inan hotel locations.';
  let ogImage = '/inan.svg';

  try {
    const snap = await getAdminDb().doc('settings/seo').get();
    if (snap.exists) {
      const seo = snap.data() as {
        siteUrl?: string; siteName?: string; defaultDescription?: string; ogImageUrl?: string;
      };
      if (seo.siteUrl) siteUrl = seo.siteUrl;
      if (seo.siteName) siteName = seo.siteName;
      if (seo.defaultDescription) description = seo.defaultDescription;
      if (seo.ogImageUrl) ogImage = seo.ogImageUrl;
    }
  } catch {
    // Fall back to defaults silently
  }

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description,
    openGraph: {
      siteName,
      type: 'website',
      locale: 'en_NG',
      url: siteUrl,
      title: siteName,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title: siteName,
      description,
      images: [ogImage],
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="min-h-screen bg-gradient-to-br from-purple-100 via-white to-purple-50">
          <RecaptchaProvider>
            <div className="min-h-screen mx-auto relative">
              {children}
            </div>
          </RecaptchaProvider>
        </div>
      </body>
    </html>
  );
}
