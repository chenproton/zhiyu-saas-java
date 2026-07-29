FROM debian:bookworm-slim

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
    ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

RUN adduser --disabled-password --gecos "" --uid 1000 appuser

COPY bin/server /app/server
COPY migrations/ /app/migrations/

RUN chown -R appuser:appuser /app

USER appuser
WORKDIR /app

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=10s \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["./server"]
