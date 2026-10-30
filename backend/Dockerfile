FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies including devDependencies for build
COPY package*.json ./
RUN npm ci

# Copy source and configuration files
COPY . .

# Build NestJS application
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy production node_modules and built dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/voucher-samples.json ./voucher-samples.json

EXPOSE 3001

CMD ["node", "dist/main"]
