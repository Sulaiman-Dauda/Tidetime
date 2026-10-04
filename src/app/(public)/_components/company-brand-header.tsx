import { getCompanySettings } from "@/server/company-settings";

/**
 * The company brand, centred above the content of a public page: the logo
 * when one is set in Settings, otherwise the company name. Never both, because
 * a logo nearly always carries the name already.
 *
 * The brand colour needs no bar of its own here: (public)/layout.tsx already
 * turns it into the accent every public page uses.
 */
export async function CompanyBrandHeader() {
  const { profile } = await getCompanySettings();

  return (
    <header className="flex justify-center px-4 pt-8 sm:pt-10">
      {profile.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.logoUrl} alt={profile.name} className="h-8 w-auto max-w-56 object-contain" />
      ) : (
        <span className="text-base font-semibold tracking-tight text-foreground">{profile.name}</span>
      )}
    </header>
  );
}
