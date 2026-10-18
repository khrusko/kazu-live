import type { Metadata } from "next";

export const SITE_URL = "https://busevi.sizel.eu";
export const SITE_NAME = "Sizel Busevi";
export const SITE_TITLE =
  "Kazu bus · vozni red Karlovačke županije | Sizel";
export const SITE_DESCRIPTION =
  "Kazu bus / Kazup bus – neslužbeni vozni red i linije Karlovačke županije. Autobusni raspored, stajališta i karta polazaka. Nepovezano s Karlovačkom županijom.";

export const SITE_KEYWORDS = [
  "kazu bus",
  "kazup bus",
  "kazup",
  "kazu",
  "KAZU",
  "autobus Karlovačka županija",
  "vozni red Karlovačka županija",
  "autobus Karlovac",
  "linije Karlovačka županija",
  "kazup.hr",
  "Sizel busevi",
];

export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const defaultMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · Sizel Busevi",
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: "Sizel", url: "https://sizel.eu" }],
  creator: "Sizel",
  publisher: "Sizel",
  category: "transport",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "hr_HR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  /** Skip "%s · Sizel Busevi" template (e.g. homepage). */
  absolute?: boolean;
}): Metadata {
  const url = absoluteUrl(input.path);
  const index = input.index ?? true;
  return {
    title: input.absolute ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: SITE_NAME,
      locale: "hr_HR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: [
          "Kazu bus",
          "Kazup bus",
          "KAZU bus",
          "Sizel busevi",
          "Autobusne linije Karlovačke županije",
        ],
        description: SITE_DESCRIPTION,
        inLanguage: "hr-HR",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Sizel",
        legalName: "Sizel j.d.o.o.",
        url: "https://sizel.eu",
        email: "info@sizel.eu",
        logo: absoluteUrl("/icon.svg"),
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "TravelApplication",
        operatingSystem: "Any",
        inLanguage: "hr-HR",
        description: SITE_DESCRIPTION,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
        },
        provider: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };
}
