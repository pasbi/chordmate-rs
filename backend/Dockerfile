# ---------- Build stage ----------
FROM rust:1.90 AS builder

WORKDIR /app

# Cache dependencies
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Build actual application
COPY migrations migrations
COPY src src
RUN cargo build --release

# ---------- Runtime stage ----------
FROM debian:trixie-slim

# Install minimal runtime deps (TLS, certs)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled binary
COPY --from=builder /app/target/release/chordmate .

# Expose backend port (optional)
EXPOSE 8080
ENTRYPOINT ["./chordmate"]
