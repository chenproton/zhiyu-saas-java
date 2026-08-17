# 公司研发基础框架（前后端一体化）

> 本项目是公司统一研发基础框架（脚手架），**前后端一体化单一仓库**：根目录为后端多模块 Maven 工程，前端 plus-ui 位于 `plus-ui/` 目录，供公司内部各业务系统快速搭建使用。

## 项目简介

- **定位**：公司级基础研发框架，新业务系统基于本仓库二次开发，统一技术栈与编码规范
- **基础**：包名 `org.dromara`，Spring Boot 4 / Java 21 / Jakarta EE 10
- **形态**：前后端一体化单仓库
  - 仓库根目录：后端多模块 Maven 工程
  - `plus-ui/`：前端工程（Vue3 + TS + Element Plus + Vite + pnpm）
- **版本**：`6.0.0`（默认分支 `dev`）

## 技术栈

### 后端

| 维度 | 技术 | 版本 |
|------|------|------|
| 运行 | Java / Spring Boot / Jetty | 21 / 4.1.0 / Jetty |
| 持久层 | MyBatis-Plus / MPJ / dynamic-datasource | 3.5.17 / 1.5.9 / 4.5.0 |
| 认证授权 | Sa-Token（JWT） | 1.45.0 |
| 缓存 | Redisson（序列化 Apache Fory） | 4.6.1 / 1.3.0 |
| 分布式任务 | SnailJob（含延迟队列、MapReduce） | 2.0.2 |
| 对象存储 | AWS SDK v2 S3（适配 MinIO / 阿里 OSS / 腾讯 COS） | 2.48.1 |
| Excel | Apache Fesod（原 EasyExcel） | 2.0.2-incubating |
| 工作流 | Warm-Flow（另含 LiteFlow 编排） | 1.8.9 / 2.16.1.2 |
| 搜索 | Easy-Es / ES Client | 3.0.2 / 7.17.28 |
| AI | Snail AI（gRPC / OpenAPI）+ Spring AI + MCP | 1.1.1 / 2.0.0 |
| 其它 | mica-mqtt / SMS4J / JustAuth / SpringDoc / Hutool / MapStruct-Plus | — |

### 前端（plus-ui）

| 维度 | 技术 | 版本 |
|------|------|------|
| 框架 | Vue / TypeScript / Vite | 3.5 / 6.x / 8.x |
| UI | Element Plus / vxe-table / ECharts | 2.14 / 4.20 / 6.1 |
| 状态/路由 | Pinia / Vue Router | 4.0 / 5.2 |
| 包管理 | pnpm（workspace） | >= 10.0.0（锁文件 10.34.5） |

## 目录结构

```
├── plus-ui/               # 前端工程（Vue3 + TS + Element Plus）
├── ruoyi-admin/           # 后端唯一可执行入口（默认端口 8080）
├── ruoyi-api/             # 跨模块 API 契约层（跨模块调用统一走这里，不直接依赖实现）
├── ruoyi-common/*         # 24 个公共能力模块（core/web/mybatis/redis/satoken/security/log/doc/
│                          #   excel/oss/json/encrypt/sensitive/translation/mail/sms/social/ai/mcp/
│                          #   elasticsearch/mqtt/push/job/liteflow/bom）
├── ruoyi-modules/*        # 业务模块：system / ai / workflow / job / gen / demo
├── ruoyi-extend/*         # 独立部署服务：monitor-admin / snailjob-server / snailai-server
├── script/                # 初始化 SQL、Docker Compose、Nginx 配置
│   ├── sql/               # ry_vue.sql / ry_workflow.sql / ry_job.sql / ry_ai.sql
│   └── docker/            # docker-compose.yml + nginx/redis 配置
└── pom.xml                # 后端 Maven 根工程
```

| 模块 | 职责 |
|------|------|
| `plus-ui` | 前端管理端（开发端口 80，代理 /dev-api → 后端 8080） |
| `ruoyi-admin` | 启动入口，聚合所有模块，包含登录/注册/验证码等认证接口 |
| `ruoyi-api` | 模块间调用契约（接口 + DTO），仅依赖 common-core |
| `ruoyi-modules/ruoyi-system` | 用户、角色、菜单、部门、字典、参数、日志、文件等系统管理 |
| `ruoyi-modules/ruoyi-gen` | 代码生成器（FreeMarker 模板，vue/react 双前端栈） |
| `ruoyi-modules/ruoyi-workflow` | 工作流（Warm-Flow） |
| `ruoyi-modules/ruoyi-job` | SnailJob 任务调度接入 |
| `ruoyi-modules/ruoyi-demo` | 框架能力演示案例（多数据源、MQTT、缓存等） |
| `ruoyi-extend/*` | 三个可独立部署的 Server（监控中心 / 调度中心 / AI 服务） |

## 环境要求

| 依赖 | 要求 | 用于 |
|------|------|------|
| JDK | 21+ | 后端 |
| Maven | 3.9+（也可用仓库自带 `mvnw` / `mvnw.cmd`） | 后端 |
| MySQL | 8.0+ | 后端 |
| Redis | 6.0+ | 后端 |
| Node.js | >= 20.19.0 | 前端 |
| pnpm | >= 10.0.0（建议与 `pnpm-lock.yaml` 一致） | 前端 |

## 快速开始

### 1. 初始化数据库

脚本位于 `script/sql/`：

| 脚本 | 用途 |
|------|------|
| `ry_vue.sql` | 主库：用户/角色/菜单/字典/参数/日志等全部基础数据（库名 `ry-vue`） |
| `ry_workflow.sql` | 工作流相关表 |
| `ry_job.sql` | SnailJob 调度中心表 |
| `ry_ai.sql` | SnailAI 相关表 |

新建数据库（如 `ry-vue`）后按需导入。

### 2. 后端配置与启动

修改 `ruoyi-admin/src/main/resources/application-dev.yml`：

- **MySQL**：默认 `localhost:3306/ry-vue`，账号 `root` / `root`
- **Redis**：默认 `localhost:6379`，密码 `ruoyi123`，db 0（单机/集群二选一，另一个注释掉）

启动方式（二选一）：

- IDE：运行 `ruoyi-admin` 下 `org.dromara.DromaraApplication`
- 命令行：

```bash
./mvnw spring-boot:run -pl ruoyi-admin
```

默认激活 `dev` 环境；支持 `local` / `dev` / `prod` 三个 profile（`mvn -P prod clean package`）。

### 3. 前端安装与启动

```bash
cd plus-ui
pnpm install        # 首次安装依赖（锁文件为 pnpm-lock.yaml，建议 pnpm i --frozen-lockfile）
pnpm dev            # 开发启动，默认 http://localhost:80
```

- 开发代理：`/dev-api` → `http://localhost:8080`（配置于 `plus-ui/vite.config.ts`，改动 `.env.development` 中的 `VITE_APP_BASE_API` 即可）
- 常用脚本（`plus-ui/package.json`）：`pnpm build`（生产打包 gzip）、`pnpm build:dev`、`pnpm lint` / `pnpm lint:fix`、`pnpm fmt`、`pnpm preview`
- 接口加密：前端 `VITE_APP_ENCRYPT=true` 与后端 `api-decrypt` 开关对应，RSA 密钥更换需前后端同步

### 4. 访问

| 地址 | 说明 |
|------|------|
| http://localhost:80 | 前端管理端页面 |
| http://localhost:8080 | 后端服务 |
| http://localhost:8080/swagger-ui/index.html | 接口文档（SpringDoc，路径以配置为准） |
| http://localhost:9090/admin | 监控中心（ruoyi-monitor-admin，默认账号 ruoyi/123456） |

默认账号：`admin`（密码以 `ry_vue.sql` 初始化数据为准，默认 `admin123`，**首次登录后请立即修改**）。

> 外置服务（`snail-job`、`snail-ai`、monitor client）默认关闭，按需在 `application-dev.yml` 中开启；基础设施（MySQL/Redis/Nginx 等）可用 `script/docker/docker-compose.yml` 一键拉起。

## 前端项目（plus-ui）

前端已并入本仓库 `plus-ui/` 目录，与后端同步开发、同步发布：

- **技术**：Vue3 + TypeScript + Element Plus + Vite + pnpm（workspace 单包结构）
- **环境变量**：`.env.development`（开发）/ `.env.production`（生产），可配置页面标题、端口、接口前缀、监控/SnailJob/SnailAI 控制台地址、接口加密密钥等
- **目录约定**：`src/api` 接口层、`src/views` 页面（与后端代码生成器产出对齐，遵循框架约定）

## 代码生成器

- 入口：系统管理 → 代码生成（`ruoyi-modules/ruoyi-gen`）
- 模板引擎：FreeMarker（模板目录 `ruoyi-modules/ruoyi-gen/src/main/resources/fm/`）
- 前端栈：`vue`（Element Plus）/ `react`（Ant Design Pro），由 `gen_table.frontend_type` 控制
- 流程：设计表结构 → 生成器导入 → 配置（包名/功能名/字段开关）→ 生成下载 → 后端代码放入对应模块、前端代码放入 `plus-ui` 对应目录

## 开发规范

- 编码约定与红线（三层无 DAO、`org.dromara` 包名、`QueryBuilder` 查询、`@AutoMapper` 转换、标准 REST 路径等）见仓库根目录 **AGENTS.md / CLAUDE.md**
- AI 辅助开发技能体系：`.codex/skills/`、`.claude/skills/`（50 个场景化技能，含 CRUD、数据权限、缓存、工作流等）
- 踩坑经验沉淀：`.claude/docs/experience/`

## 部署

> 完整初始化与部署手册见 **docs/初始化与部署指南.md**。

### 后端

```bash
mvn clean package -P prod          # 默认跳过测试
java -jar ruoyi-admin/target/ruoyi-admin.jar
```

### 前端

```bash
cd plus-ui
pnpm install
pnpm build                        # 产物在 plus-ui/dist
```

将 `dist` 交由 Nginx 托管（参考 `script/docker/nginx/conf/nginx.conf`，`/prod-api` 反向代理到后端 8080）。monitor-admin / snailjob-server / snailai-server 三个外置服务可独立部署，整体基础设施可用 `script/docker/docker-compose.yml` 编排。
