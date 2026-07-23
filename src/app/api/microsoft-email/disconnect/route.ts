import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { disconnectMicrosoftEmail } from "@/server/microsoft-email";
import { getEmailProvider, setEmailProvider } from "@/server/settings";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await disconnectMicrosoftEmail();
  if (await getEmailProvider() === "microsoft365") {
    await setEmailProvider("smtp");
  }
  return NextResponse.json({ ok: true, activeProvider: "smtp" });
}
