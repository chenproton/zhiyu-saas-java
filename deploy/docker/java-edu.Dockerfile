# zhiyu-saas Java 版前端镜像（React/Next.js，代码与 Go 版同一套，零改动）
# 保持 Next standalone 原始相对结构（符号链接依赖布局）：
#   /app/node_modules/               ← standalone/node_modules（.pnpm 实体依赖）
#   /app/apps/edu/node_modules/      ← standalone/apps/edu/node_modules（next 等顶层符号链接）
#   /app/apps/edu/{server.js,.next,public}
FROM node:22-alpine

WORKDIR /app/apps/edu

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3020
# Next.js rewrites 反代目标（Java 后端容器，compose 网络内直连）
ENV API_PROXY_URL=http://java-backend:8080

COPY --chown=node:node node_modules/ /app/node_modules/
COPY --chown=node:node apps/edu/node_modules/ /app/apps/edu/node_modules/
COPY --chown=node:node apps/edu/package.json /app/apps/edu/package.json
COPY --chown=node:node apps/edu/server.js /app/apps/edu/server.js
COPY --chown=node:node apps/edu/.next/ /app/apps/edu/.next/
COPY --chown=node:node apps/edu/public/ /app/apps/edu/public/

USER node
EXPOSE 3020

CMD ["node", "server.js"]
