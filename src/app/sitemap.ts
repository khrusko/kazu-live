import fs from "fs";
import path from "path";
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

function lineIds(): string[] {
  try {
    const file = path.join(process.cwd(), "data", "network.json");
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      lines?: { id: string }[];
      updatedAt?: string;
    };
    return (raw.lines ?? []).map((line) => line.id);
  } catch {
    return [];
  }
}

function networkUpdatedAt(): Date {
  try {
    const file = path.join(process.cwd(), "data", "network.json");
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { updatedAt?: string };
    if (raw.updatedAt) return new Date(raw.updatedAt);
    return fs.statSync(file).mtime;
  } catch {
    return new Date();
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = networkUpdatedAt();
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/linije`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/karta`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/obavijesti`, lastModified, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/karte`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/privatnost`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];

  const linePages: MetadataRoute.Sitemap = lineIds().map((id) => ({
    url: `${SITE_URL}/linije/${encodeURIComponent(id)}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...linePages];
}
