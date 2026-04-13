FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install all deps
RUN pnpm install --frozen-lockfile

# Copy source — shared
COPY packages/shared/src ./packages/shared/src

# Copy source — API
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/

# Copy source — Web
COPY apps/web/src ./apps/web/src
COPY apps/web/next.config.ts ./apps/web/
COPY apps/web/tsconfig.json ./apps/web/

# Build shared, then API and Web
RUN pnpm --filter @lefse/shared build
RUN pnpm --filter @lefse/api build
RUN pnpm --filter @lefse/web build

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3001
EXPOSE 3000

# SERVICE=api (default) or SERVICE=web
CMD ["/app/start.sh"]
