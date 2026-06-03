import { redirect } from "next/navigation";

// The company settings hub moved to /dashboard/settings. Keep this route as a
// permanent redirect so old links and bookmarks continue to work.
export default function CompanySettingsRedirect() {
  redirect("/dashboard/settings");
}
