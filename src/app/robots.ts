import type { MetadataRoute } from "next";
import { getAppUrl } from "@/server/app-url";

// Rendered at request time so the URLs follow the custom domain saved in
// Settings (and the build doesn't need a database).
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const appUrl = await getAppUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: ["/api/", "/dashboard/", "/booking/"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
