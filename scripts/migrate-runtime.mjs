import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const client = postgres(databaseUrl, { max: 1 });
try {
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.info("[database] migrations complete");
} finally {
  await client.end();
}
