import type { MetadataRoute } from "next";
import { getAppUrl } from "@/server/app-url";

// Rendered at request time so the URLs follow the custom domain saved in
// Settings (and the build doesn't need a database).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = await getAppUrl();
  const now = new Date();
  return [
    {
      url: appUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${appUrl}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
