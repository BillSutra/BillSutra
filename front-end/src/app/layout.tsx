import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";
import SessionProvider from "../providers/sessionProvider";
import { Toaster } from "@/components/ui/sonner";
import QueryProvider from "../providers/QueryProvider";
import AuthTokenSync from "../providers/AuthTokenSync";
import ThemeProvider from "@/components/theme-provider";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "BillSutra",
  description: "Billing, invoicing, and inventory control for growing teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} ${fraunces.variable} bg-background text-foreground antialiased transition-colors duration-300`}
      >
        <ThemeProvider>
          <SessionProvider>
            <QueryProvider>
              <AuthTokenSync />
              {children}
              <Toaster richColors duration={10000} />
            </QueryProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
