import { getCompanySettings } from "@/server/company-settings";
import { normalizeBrandColor } from "@/lib/company-settings";

/**
 * Company-wide branding banner for public pages (single-company model):
 * a thin brand-colour accent bar plus the company logo/name. Driven by the
 * admin's Company Settings → General profile.
 *
 * `accentOnly` keeps the accent bar but drops the logo/name row, for pages
 * that already show the company brand in their own layout (the booking page
 * carries it at the top of the service sidebar). Repeating it in both places
 * read as two competing headers.
 */
export async function CompanyBrandHeader({ accentOnly = false }: { accentOnly?: boolean }) {
  const { profile } = await getCompanySettings();
  const brand = normalizeBrandColor(profile.brandColor);

  return (
    <header>
      <div className="h-1 w-full" style={{ backgroundColor: brand }} aria-hidden />
      {accentOnly ? null : (
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-4">
          {profile.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt={profile.name} className="h-7 w-auto object-contain" />
          ) : (
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: brand }}
              aria-hidden
            />
          )}
          <span className="text-sm font-semibold tracking-tight">{profile.name}</span>
        </div>
      )}
    </header>
  );
}
