// Vitest setup: provide deterministic env vars so modules that read env at
// import time (crypto, mailer, etc.) don't throw during unit tests.
process.env.AUTH_SECRET ??= "test-auth-secret-please-change";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/tidetime_test";
process.env.APP_URL ??= "http://localhost:3000";
