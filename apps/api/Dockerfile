# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates python3 python3-pip \
	&& rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir tinker transformers tiktoken --break-system-packages

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

# --- deps ---
FROM base AS deps

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

# --- build ---
FROM deps AS build

# Copy source
COPY packages/shared packages/shared
COPY apps/api apps/api

# Prisma generate + TS build
RUN pnpm --filter @finance-agent/shared build
RUN pnpm --filter @finance-agent/api prisma:generate
RUN pnpm --filter @finance-agent/api build

# --- runtime ---
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Cloud Run sets PORT; our app uses API_PORT
ENV API_PORT=8080

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY apps/api/tinker_bridge.py apps/api/tinker_bridge.py

EXPOSE 8080
CMD ["node", "apps/api/dist/server.js"]
