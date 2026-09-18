import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "../styles/globals.css";
import RecaptchaProvider from "../components/RecaptchaProvider";
import { TenantProvider } from "../contexts/TenantContext";
import BrandProvider from "../components/BrandProvider";
import OfflineBanner from "../components/OfflineBanner";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const FALLBACK_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://inan.com.ng';

export const metadata: Metadata = {
  metadataBase: new URL(FALLBACK_URL),
  title: {
    default: 'Inan Feedback',
    template: '%s | Inan Feedback',
  },
  description: 'Collect, manage and analyse guest feedback across all Inan hotel locations.',
  icons: { icon: '/favicon.png', apple: '/favicon.png' },
  openGraph: {
    siteName: 'Inan Feedback',
    type: 'website',
    locale: 'en_NG',
    url: FALLBACK_URL,
    title: 'Inan Feedback',
    description: 'Collect, manage and analyse guest feedback across all Inan hotel locations.',
    images: [{ url: '/inan.svg', width: 1200, height: 630, alt: 'Inan Feedback' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Inan Feedback',
    description: 'Collect, manage and analyse guest feedback across all Inan hotel locations.',
    images: ['/inan.svg'],
  },
};

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
            <TenantProvider>
              <BrandProvider />
              <OfflineBanner />
              <div className="min-h-screen mx-auto relative">
                {children}
              </div>
            </TenantProvider>
          </RecaptchaProvider>
        </div>
      </body>
    </html>
  );
}
