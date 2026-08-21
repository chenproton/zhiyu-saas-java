---
name: start
description: |
  /start - 项目快速启动

  触发词：/start、启动、跑起来、本地启动、启动项目
---

# /start - 项目快速启动

帮助在本地把 base-dev-framework6-java 后端跑起来。

## 环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| JDK | **21** | 6.x 要求 Java 21（Spring Boot 4） |
| Maven | 3.8+ | 自带 `mvnw` Wrapper 可用 |
| MySQL | 5.7+/8.x | 导入 `script/sql/ry_vue.sql` |
| Redis | 6+ | 必需（缓存/会话/限流） |

## 启动流程

1. **激活** `dev-startup`（若已生成）。
2. **数据库**：建库 → 导入 `script/sql/ry_vue.sql`（按需 `ry_ai.sql` 等）。
3. **改配置**：`ruoyi-admin/src/main/resources/application-dev.yml`（数据源、Redis、按需 `snail-ai`/`easy-es`/`message` 开关）。
4. **编译**：`mvn -DskipTests clean package`（或 `./mvnw`）。
5. **启动**：运行 `ruoyi-admin` 的启动类（IDEA），或 `java -jar ruoyi-admin/target/*.jar --spring.profiles.active=dev`。
6. **外置 Server（按需）**：`ruoyi-extend/ruoyi-monitor-admin`、`ruoyi-snailjob-server`、`ruoyi-snailai-server` 各自独立启动。
7. **验证**：访问 actuator 健康端点 / SpringDoc 接口文档（端口见 `application.yml` 的 `server.port`，不确定先问，别捏造 URL）。

## 常见坑

- 启动报 plugin prefix 错 → 检查 Maven profile（local/dev/prod）。
- 端口被占 → `netstat -ano | findstr <端口>` 定位后按 PID 处理（勿按名杀宿主进程）。
- 容器是 **Jetty** 不是 Tomcat（6.x 已切换）。
