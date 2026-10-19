import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { CookieBanner } from "@/components/cookie-banner";
import { Header } from "@/components/header";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { defaultMetadata, websiteJsonLd } from "@/lib/seo";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-figtree",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = defaultMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = websiteJsonLd();
  return (
    <html lang="hr" className={`${figtree.variable} ${fraunces.variable} h-full`} suppressHydrationWarning>
      <body className="flex h-dvh flex-col overflow-hidden antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
          <Providers>
            <Header />
            <div className="relative min-h-0 flex-1">
              <div className="absolute inset-0 overflow-y-auto">{children}</div>
            </div>
            <SiteFooter />
            <CookieBanner />
            <Toaster position="top-center" />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
