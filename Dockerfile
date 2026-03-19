# --- build ---
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- production ---
FROM oven/bun:1-slim AS production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production

# Client build output
COPY --from=build /app/dist/client ./dist/client

# Server source (Bun runs TypeScript directly)
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./

# データディレクトリの事前作成
RUN mkdir -p /data/db /data/thumbnails

ENV NODE_ENV=production
ENV IMAGE_DIR=/images
ENV DB_PATH=/data/db/viewer.db
ENV THUMB_DIR=/data/thumbnails
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "src/server/index.ts"]
