import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/header";
import { Providers } from "@/components/providers";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-figtree",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "KaŽu Live",
  description: "Karta, vozni red i karte županijskih autobusa Karlovačke županije.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hr" className={`${figtree.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full antialiased">
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
          <Providers>
            <Header />
            {children}
            <Toaster position="top-center" />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
