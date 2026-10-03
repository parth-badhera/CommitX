# syntax=docker/dockerfile:1
# CommitX web app — production image (Next.js standalone + Prisma + SQLite volume)

FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── deps ─────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts && npx prisma generate

# ── build ────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined at build time — pass them as build args
ARG NEXT_PUBLIC_CHAIN_ID
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_PROTOCOL_ATTESTOR_ADDRESS
ARG NEXT_PUBLIC_TREASURY_ADDRESS
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# ── run ──────────────────────────────────────────────
FROM base AS run
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/data/commitx.db
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Create/upgrade the schema on the volume, then start
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate && node server.js"]
