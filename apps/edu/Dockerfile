FROM node:22-alpine

COPY --chown=node:node . /app

USER node
WORKDIR /app
EXPOSE 3020
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENTRYPOINT ["node", "server.js"]
