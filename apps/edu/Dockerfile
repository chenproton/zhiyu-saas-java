FROM node:22-alpine

RUN adduser -D -u 1000 appuser

COPY --chown=appuser:appuser . /app

USER appuser
WORKDIR /app
EXPOSE 3020
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENTRYPOINT ["node", "server.js"]
