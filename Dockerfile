FROM node:22-alpine

WORKDIR /app

# Install pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

# Install all deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/src ./packages/shared/src
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/

# Build shared first, then API
RUN pnpm --filter @lefse/shared build
RUN pnpm --filter @lefse/api build

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
