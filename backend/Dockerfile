FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata busybox-extras
ENV TZ=Asia/Shanghai

RUN adduser -D -u 1000 appuser

COPY bin/server /app/server

RUN mkdir -p /app/migrations && chown -R appuser:appuser /app
COPY migrations/ /app/migrations/

USER appuser
WORKDIR /app

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=10s \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["./server"]
