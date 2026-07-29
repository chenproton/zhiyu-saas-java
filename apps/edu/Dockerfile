FROM node:22-alpine

RUN addgroup -g 1000 appuser && adduser -u 1000 -G appuser -D appuser

COPY --chown=appuser:appuser . /app

USER appuser
WORKDIR /app
EXPOSE 3020
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENTRYPOINT ["node", "server.js"]
