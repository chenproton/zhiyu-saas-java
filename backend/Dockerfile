FROM alpine:3.21

RUN apk add --no-cache ca-certificates && adduser -D -u 1000 appuser

COPY server /app/server
COPY migrations/ /app/migrations/
RUN chown -R appuser:appuser /app

USER appuser
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["./server"]
