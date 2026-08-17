# zhiyu-saas Java 版前端镜像（React/Next.js，代码与 Go 版同一套）
# 构建上下文：apps/edu/.next/standalone（Next.js standalone 输出目录）
FROM node:22-alpine

COPY --chown=node:node . /app

WORKDIR /app/apps/edu
USER node
EXPOSE 3020
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3020
# Next.js rewrites 反代目标（Java 后端容器，compose 网络内直连）
ENV API_PROXY_URL=http://java-backend:8080

ENTRYPOINT ["node", "server.js"]
