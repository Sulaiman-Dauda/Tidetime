FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# AUTH_SECRET is intentionally NOT provided here — it is a runtime-only secret and
# must never be baked into image layers. env.ts skips the AUTH_SECRET requirement
# during `next build`. APP_URL/DATABASE_URL are placeholders for the build only.
# --max-old-space-size: the build needs >2GB of heap (2048 dies with SIGABRT
# "Ineffective mark-compacts near heap limit"). 4096 is a ceiling, not an
# allocation — V8 only takes what it needs; swap absorbs the peak on small VPSes
# (the installer provisions it).
RUN APP_URL=http://localhost:3100 \
    DATABASE_URL=postgres://postgres:postgres@localhost:5432/tidetime \
    NODE_OPTIONS=--max-old-space-size=4096 \
    npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

# The git commit this image was built from, so the running app can compare
# itself against the latest on GitHub and offer updates. Passed by CI.
ARG TIDETIME_COMMIT=""
ENV TIDETIME_COMMIT=$TIDETIME_COMMIT

RUN addgroup -S nodejs -g 1001 \
  && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate-runtime.mjs ./scripts/migrate-runtime.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/jobs-worker.mjs ./scripts/jobs-worker.mjs
# The migration entrypoint is outside Next's server trace, so copy its two
# dependency packages explicitly instead of shipping the full node_modules tree.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres

USER nextjs
EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
