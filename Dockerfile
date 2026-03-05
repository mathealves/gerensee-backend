# Stage 1: Install all dependencies (dev + prod, needed for build)
FROM node:20-alpine AS deps
RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Generate Prisma client and compile TypeScript
FROM node:20-alpine AS builder
RUN corepack enable pnpm
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm prisma:generate
RUN pnpm build

# Stage 3: Install production-only dependencies
FROM node:20-alpine AS prod-deps
RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Stage 4: Minimal production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy compiled output
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy production node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy generated Prisma client (contains runtime JS + type definitions)
COPY --from=builder --chown=nestjs:nodejs /app/src/generated ./src/generated

# Copy Prisma schema (needed for Prisma runtime introspection)
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main"]
