# syntax=docker/dockerfile:1

FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/pnpm-lock.yaml ./
RUN corepack enable \
  && pnpm config set minimumReleaseAge 0 \
  && pnpm install --frozen-lockfile
COPY client/ ./
RUN pnpm build

FROM rust:1.88-bookworm AS server-build
WORKDIR /app/server
COPY server/Cargo.toml server/Cargo.lock ./
COPY server/src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=server-build /app/server/target/release/on_mars_server /app/on_mars_server
COPY --from=client-build /app/client/dist /app/dist
ENV SERVER_ADDR=0.0.0.0:8080
ENV STATIC_DIR=/app/dist
EXPOSE 8080
CMD ["/app/on_mars_server"]
