# HappyView AppView — builds upstream gamesgamesgamesgamesgames/happyview v2.13.0
# from source (git clone inside build) so Railway can deploy from THIS repo.
# The build stages mirror upstream's Dockerfile exactly; we just add the clone.
FROM alpine/git:2.54.0 AS source
WORKDIR /src
ARG HAPPYVIEW_REF=v2.13.0
RUN git clone --depth 1 --branch ${HAPPYVIEW_REF} https://github.com/gamesgamesgamesgamesgames/happyview.git .

FROM node:22-alpine AS frontend
WORKDIR /app/web
COPY --from=source /src/web/package.json /src/web/package-lock.json ./
RUN npm ci
COPY --from=source /src/web/ ./
ENV NEXT_PUBLIC_BASE_PATH=/__HAPPYVIEW_BP__
RUN npm run build

FROM rust:1.96.1-bookworm AS builder

WORKDIR /app
COPY --from=source /src/Cargo.toml /src/Cargo.lock ./
COPY --from=source /src/crates/happyview-nsid/Cargo.toml crates/happyview-nsid/
RUN mkdir -p crates/happyview-nsid/src && touch crates/happyview-nsid/src/lib.rs
RUN mkdir -p src/bin && echo "fn main() {}" > src/main.rs && touch src/lib.rs && echo "fn main() {}" > src/bin/migrate_lua_sql.rs && echo "fn main() {}" > src/bin/migrate_space_cids.rs
ENV SQLX_OFFLINE=true
RUN cargo build --release && rm -rf src target/release/.fingerprint/happyview-*

COPY --from=source /src/src/ src/
COPY --from=source /src/crates/ crates/
COPY --from=source /src/migrations/ migrations/
ARG HAPPYVIEW_VERSION
ENV HAPPYVIEW_VERSION=$HAPPYVIEW_VERSION
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/happyview /usr/local/bin/happyview
RUN chmod +x /usr/local/bin/happyview
COPY --from=builder /app/migrations /app/migrations
COPY --from=frontend /app/web/out /srv/static
COPY --from=source /src/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && touch /srv/static/.base-path-pending

ENV STATIC_DIR=/srv/static

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
