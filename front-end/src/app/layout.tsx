import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import {
  Fraunces,
  Geist,
  Geist_Mono,
  Noto_Sans_Devanagari,
  Sora,
} from "next/font/google";
import "./globals.css";
import SessionProvider from "../providers/sessionProvider";
import { Toaster } from "@/components/ui/sonner";
import QueryProvider from "../providers/QueryProvider";
import AuthTokenSync from "../providers/AuthTokenSync";
import ThemeProvider from "@/components/theme-provider";
import { LanguageProvider } from "@/providers/LanguageProvider";
import ObservabilityProvider from "@/providers/ObservabilityProvider";
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_COOKIE_KEY,
} from "@/i18n";
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

const hindiSans = Noto_Sans_Devanagari({
  variable: "--font-hindi-sans",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BillSutra",
  description: "Billing, invoicing, and inventory control for growing teams.",
  icons: {
    icon: [{ url: "/brand-icon.png", sizes: "256x256", type: "image/png" }],
    shortcut: [{ url: "/brand-icon.png", type: "image/png" }],
    apple: [{ url: "/brand-icon.png", sizes: "256x256", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#123d65",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieLanguage = cookieStore.get(LANGUAGE_COOKIE_KEY)?.value;
  const initialLanguage = isLanguage(cookieLanguage)
    ? cookieLanguage
    : DEFAULT_LANGUAGE;

  return (
    <html lang={initialLanguage} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} ${fraunces.variable} ${hindiSans.variable} bg-background text-foreground antialiased transition-colors duration-300`}
      >
        <LanguageProvider initialLanguage={initialLanguage}>
          <ThemeProvider>
            <SessionProvider>
              <QueryProvider>
                <AuthTokenSync />
                <ObservabilityProvider />
                {children}
                <Toaster richColors duration={10000} />
              </QueryProvider>
            </SessionProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
