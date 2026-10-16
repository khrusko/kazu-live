import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { CookieBanner } from "@/components/cookie-banner";
import { Header } from "@/components/header";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const pdark = localFont({
  src: "../fonts/pdark.ttf",
  variable: "--font-pdark",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-figtree",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Sizel - autobusne linije Karlovačke županije",
  description: "Neslužbena stranica autobusnih linija Karlovačke županije. Sizel nije povezan sa županijom ni s prijevoznicima.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hr" className={`${figtree.variable} ${fraunces.variable} ${pdark.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
          <Providers>
            <Header />
            {children}
            <SiteFooter />
            <CookieBanner />
            <Toaster position="top-center" />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
