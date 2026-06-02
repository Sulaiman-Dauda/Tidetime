import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env, isProd } from "@/lib/env";
import * as schema from "./schema";

const connectionString = env.databaseUrl;

// Reuse a single connection in dev to avoid exhausting the pool on HMR.
const globalForDb = globalThis as unknown as { __tidetimeSql?: postgres.Sql };

const sql =
  globalForDb.__tidetimeSql ??
  postgres(connectionString, { max: 10, prepare: false });

if (!isProd) globalForDb.__tidetimeSql = sql;

export const db = drizzle(sql, { schema, casing: "snake_case" });
export { schema };
export type Database = typeof db;
