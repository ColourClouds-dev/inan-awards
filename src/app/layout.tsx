import { Inter } from "next/font/google";
import "../styles/globals.css";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";

const OfflineIndicator = dynamic(() => import("../components/OfflineIndicator"), { 
  ssr: false 
});

const CustomDocument = dynamic(() => import("../components/CustomDocument"), {
  ssr: false
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: 'INAN Forms',
  description: 'INAN Forms Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <CustomDocument>
          <div className="min-h-screen bg-gradient-to-br from-purple-100 via-white to-purple-50">
            <div className="min-h-screen mx-auto relative">
              {children}
              <Link href="/login" className="fixed bottom-4 left-4 p-2 rounded-full bg-white/80 hover:bg-white shadow-md transition-all duration-200">
                <Image src="/login.svg" alt="Login" width={24} height={24} className="text-gray-600" />
              </Link>
              <OfflineIndicator />
            </div>
          </div>
        </CustomDocument>
      </body>
    </html>
  );
}
