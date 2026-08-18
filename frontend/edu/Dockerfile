FROM nginx:1.27-alpine

# 纯静态 SPA 托管：vite build 产物 dist/（含 index.html + 构建资产 + public 静态资源）
# 由部署脚本以 frontend/edu 为构建上下文，.dockerignore 只放行 dist/ 与 nginx.conf。
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html

EXPOSE 3020
