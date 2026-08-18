FROM alpine:3.21

ARG SKIP_APK_ADD=false
RUN if [ "$SKIP_APK_ADD" != "true" ]; then apk add --no-cache ca-certificates; fi && adduser -D -u 1000 appuser

COPY server /app/server
COPY migrations/ /app/migrations/
COPY ip2region_v4.xdb /app/data/ip2region_v4.xdb
RUN chown -R appuser:appuser /app && mkdir -p /opt/zhiyu-saas/uploads && chown appuser:appuser /opt/zhiyu-saas/uploads

USER appuser
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["./server"]
