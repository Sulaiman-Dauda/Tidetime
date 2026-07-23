import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to reset a database while NODE_ENV=production");
}

const url = new URL(databaseUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (!localHosts.has(url.hostname)) {
  throw new Error(`Refusing to reset non-local database host: ${url.hostname}`);
}

const databaseName = decodeURIComponent(url.pathname.slice(1));
if (!databaseName || ["postgres", "template0", "template1"].includes(databaseName)) {
  throw new Error(`Refusing to reset protected database: ${databaseName || "(empty)"}`);
}

const confirmIndex = process.argv.indexOf("--confirm");
const confirmation =
  confirmIndex >= 0 ? process.argv[confirmIndex + 1] : undefined;
if (confirmation !== databaseName) {
  throw new Error(
    `Confirmation required: npm run db:reset -- --confirm ${databaseName}`,
  );
}

const client = postgres(databaseUrl, { max: 1 });
try {
  await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await client.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await client.unsafe("CREATE SCHEMA public");
  await client.unsafe("GRANT ALL ON SCHEMA public TO public");
  console.info(`[database] reset local database: ${databaseName}`);
  console.info("[database] next: npm run db:migrate && npm run db:seed");
} finally {
  await client.end();
}
