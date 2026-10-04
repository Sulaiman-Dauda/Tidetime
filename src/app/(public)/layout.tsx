import { getCompanySettings } from "@/server/company-settings";
import { normalizeBrandColor } from "@/lib/company-settings";
import { brandThemeCss } from "@/lib/brand-theme";

/**
 * Every public page (booking, confirmation, legal) takes its accent from the
 * company brand colour set in Settings. The colour is validated as hex by
 * normalizeBrandColor, so it is safe to write into a style element.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCompanySettings();
  return (
    <div data-brand-scope className="contents">
      <style>{brandThemeCss(normalizeBrandColor(profile.brandColor))}</style>
      {children}
    </div>
  );
}
