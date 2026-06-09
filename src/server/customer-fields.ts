import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, type CustomerFieldDef } from "@/db/schema";
import { normalizeFieldDefs } from "@/lib/customer-fields";

/** app_settings key holding the instance-wide custom customer field definitions. */
const KEY = "customer_custom_fields";

/** Current custom customer field definitions (always a clean, capped list). */
export async function getCustomerFieldDefs(): Promise<CustomerFieldDef[]> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.name, KEY))
    .limit(1);
  return normalizeFieldDefs(row?.value);
}

/** Replace the custom customer field definitions (admin action). */
export async function setCustomerFieldDefs(defs: unknown): Promise<CustomerFieldDef[]> {
  const clean = normalizeFieldDefs(defs);
  await db
    .insert(appSettings)
    .values({ name: KEY, value: clean })
    .onConflictDoUpdate({ target: appSettings.name, set: { value: clean } });
  return clean;
}
