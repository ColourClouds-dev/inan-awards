import { Inter } from "next/font/google";
import "../styles/globals.css";
import RecaptchaProvider from "../components/RecaptchaProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: 'INAN Feedback',
  description: 'INAN Feedback Platform',
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
            <div className="min-h-screen mx-auto relative">
              {children}
            </div>
          </RecaptchaProvider>
        </div>
      </body>
    </html>
  );
}
