import type { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/events";
import { siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: siteUrl("/events"), changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/pricing"), changeFrequency: "monthly", priority: 0.8 },
    ...(await getAllSlugs()).map((e) => ({
      url: siteUrl(`/events/${e.slug}`),
      lastModified: new Date(e.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
