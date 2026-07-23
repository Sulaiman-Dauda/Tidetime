import { cpSync, existsSync, mkdirSync } from "node:fs";

if (!existsSync(".next/standalone/server.js")) {
  throw new Error("Run npm run build before starting the standalone server");
}
mkdirSync(".next/standalone/.next", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
if (existsSync("public")) cpSync("public", ".next/standalone/public", { recursive: true });
