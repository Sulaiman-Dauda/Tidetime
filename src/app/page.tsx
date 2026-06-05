import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await hasAnyUser())) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  redirect("/login");
}
