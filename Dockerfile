# ── Stage 1: Build the client ─────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build:client

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy server source and migrations
COPY server ./server
COPY migrations ./migrations

# Copy built client from builder stage
COPY --from=builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server/index.js"]
