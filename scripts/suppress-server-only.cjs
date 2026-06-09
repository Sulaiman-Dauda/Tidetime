// Preload script: intercepts require('server-only') and redirects to a no-op.
// Used by standalone scripts (db:migrate:runtime, jobs:reminders:runtime)
// that run outside of Next.js's bundler, where server-only would throw.
const Module = require("module");
const path = require("path");

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request) {
  if (request === "server-only") {
    return path.join(__dirname, "noop-server-only.cjs");
  }
  return origResolve.apply(this, arguments);
};
