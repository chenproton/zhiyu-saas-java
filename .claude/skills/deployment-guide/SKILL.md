---
name: deployment-guide
description: |
  base-dev-framework6-java部署与上线指南。覆盖 JDK 21 + Spring Boot 4 + Jetty 容器的 Maven 打包、可执行 JAR 部署、Docker / docker-compose 编排、ruoyi-monitor-admin / ruoyi-snailjob-server / ruoyi-snailai-server 三个外置 server 独立部署、Nginx 反向代理、生产配置 application-prod.yml 与密钥安全替换、SPRING_PROFILES_ACTIVE profile 切换。

  触发场景：
  - 需要把后端打包成可执行 JAR 并部署到测试 / 生产服务器
  - 需要用 Docker / docker-compose 一键编排 MySQL / Redis / Nginx / 后端 / 外置 server
  - 需要单独部署监控中心、SnailJob 调度中心或 SnailAI server（含 gRPC 18888 / HTTP 8900）
  - 需要配置 Nginx 反向代理 /prod-api、/admin、/snail-job、/snail-ai 路径
  - 需要把生产环境的数据源 / Redis / JWT / RSA 密钥换成安全值，切换 profile

  触发词：部署、上线、发布、生产环境、Docker、Compose、docker-compose、构建、build、打包、JAR、可执行jar、Jetty、Nginx、反向代理、密钥、安全配置、profile、application-prod、SPRING_PROFILES_ACTIVE、外置server、monitor-admin、snailjob、snailai-server、监控、deployment、运维、容器、镜像
---

# base-dev-framework6-java 部署指南（deployment-guide）

## 一、概述

base-dev-framework6-java（`org.dromara` 包路径）的部署区别于旧版本，关键事实务必先记牢：

| 维度 | 真实值（来自源码） | 说明 |
|------|------------------|------|
| 运行时 | **JDK 21** | 根 `pom.xml` `<java.version>21</java.version>`；镜像 `bellsoft/liberica-openjdk-rocky:21.0.11-cds` |
| 框架 | **Spring Boot 4.1.0** | `<spring-boot.version>4.1.0</spring-boot.version>`，`spring-ai 2.0.0` |
| Web 容器 | **Jetty（非 Tomcat）** | `ruoyi-common-web/pom.xml` 排除 `spring-boot-starter-tomcat`、引入 `spring-boot-starter-jetty`；打的是可执行 JAR，**不是 war 丢 Tomcat** |
| 版本号 | `revision = 5.5.3` | 统一版本（`flatten-maven-plugin` 维护），制品名带 `5.5.3` |
| 入口模块 | `ruoyi-admin` | `spring-boot-maven-plugin` `repackage` 出可执行 jar `ruoyi-admin.jar` |
| GC | **ZGC** | 所有 Dockerfile 用 `-XX:+UseZGC` |

> 铁律：包名是 `org.dromara`，**禁止**出现 `plus.ruoyi` / `com.ruoyi` 路径；容器是 **Jetty 非 Tomcat**；前端（plus-ui）在**仓库内 plus-ui/ 目录**，本指南只泛述前端构建产物如何交给 Nginx，不展开前端代码。

部署拓扑（生产典型）：

```
        ┌─────────────── Nginx (80/443) ───────────────┐
        │  /            → 前端静态资源 (plus-ui 构建产物)  │
        │  /prod-api/   → upstream server (8080/8081)    │
        │  /admin/      → monitor-admin (9090)           │
        │  /snail-job/  → snailjob-server (8800)         │
        │  /snail-ai/   → snailai-server (8900)          │
        └────────────────────────────────────────────────┘
                │            │             │           │
          ruoyi-admin   monitor-admin  snailjob    snailai
          (主应用×N)     (监控中心)    (调度中心)   (AI server)
                │
        ┌───────┴────────┬──────────┬──────────┐
       MySQL 8.4       Redis 8.x   MinIO     (可选 ES/Oracle)
```

## 二、打包（Maven build）

### 2.1 环境前置

- JDK **21**（必须，21 以下无法编译 Spring Boot 4）
- Maven 3.9+（仓库已配华为云镜像 `mirrors.huaweicloud.com`，国内拉包快）
- 打包默认 `maven.test.skip=true`（根 pom 已设），无需手动跳测试，但建议显式加 `-DskipTests`

### 2.2 打包命令

```bash
# 在项目根目录执行：clean + package，profile 决定 application-{profiles.active}.yml 生效哪份
# -P prod 激活生产 profile（profiles.active=prod，日志级别 warn）
mvn -P prod -DskipTests clean package

# 默认 profile：根 pom 中 dev 为 activeByDefault=true，不带 -P 即打 dev 包
mvn -DskipTests clean package

# 如需代码生成模块，激活 ruoyi-admin 的 gen profile
mvn -P prod,gen -DskipTests clean package
```

产物（`repackage` 后的**可执行 fat jar**）：

```
ruoyi-admin/target/ruoyi-admin.jar                              # 主应用入口
ruoyi-extend/ruoyi-monitor-admin/target/ruoyi-monitor-admin.jar  # 监控中心
ruoyi-extend/ruoyi-snailjob-server/target/ruoyi-snailjob-server.jar # 调度中心
ruoyi-extend/ruoyi-snailai-server/target/ruoyi-snailai-server.jar   # AI server
```

> 关键：`ruoyi-admin/pom.xml` 配了 `spring-boot-maven-plugin` 的 `repackage` goal，`<finalName>ruoyi-admin</finalName>`，所以产物固定叫 `ruoyi-admin.jar`，Dockerfile 的 `ADD ./target/ruoyi-admin.jar` 正是依赖这个固定名。三个外置 server 同理（各自模块的 `repackage`）。

### 2.3 profile 与配置过滤

根 pom 定义了三个 profile：

| profile | `profiles.active` | 日志级别 | 默认激活 |
|---------|-------------------|---------|---------|
| `local` | local | info | 否 |
| `dev`   | dev   | info | **是**（`activeByDefault=true`）|
| `prod`  | prod  | warn | 否 |

`application-prod.yml` 中 `@monitor.username@` / `@monitor.password@` 这类 `@...@` 占位符由 Maven resources filtering 在打包时替换（pom `<resources>` 对 `application*` 启用 filtering）。所以**改 monitor 账号密码要改 pom 的 profile 属性**，不是直接改 yml。

## 三、可执行 JAR 部署（裸机 / 无 Docker）

### 3.1 直接启动

```bash
# 最简启动（profile 由 spring.profiles.active 决定，可用环境变量覆盖）
java -jar ruoyi-admin.jar --spring.profiles.active=prod

# 生产推荐：固定端口 + ZGC + OOM dump（对齐 Dockerfile 的 JVM 参数）
java -Djava.security.egd=file:/dev/./urandom \
     -Dserver.port=8080 \
     -Dsnail-job.port=28080 \
     -Dsnail-ai.port=38080 \
     -XX:+HeapDumpOnOutOfMemoryError -XX:+UseZGC \
     -jar ruoyi-admin.jar --spring.profiles.active=prod
```

> 端口约定（来自 Dockerfile `ENV` + application-prod.yml）：主应用 `SERVER_PORT=8080`，SnailJob 客户端端口 `SNAIL_JOB_PORT=28080`，SnailAI 客户端端口 `SNAIL_AI_PORT=38080`。application-prod.yml 里 `snail-job.port: 2${server.port}` 表示客户端端口随主端口漂移（8080→28080）。

### 3.2 后台常驻（systemd 示例）

```ini
# /etc/systemd/system/ruoyi-admin.service
[Unit]
Description=base-dev-framework6-java Admin
After=network.target mysql.service redis.service

[Service]
WorkingDirectory=/ruoyi/server
# 用环境变量切 profile，不写死在 jar 里
Environment="SPRING_PROFILES_ACTIVE=prod"
Environment="JAVA_OPTS=-Xms1g -Xmx2g -XX:+UseZGC -XX:+HeapDumpOnOutOfMemoryError"
ExecStart=/usr/bin/java $JAVA_OPTS -jar /basic/server/ruoyi-admin.jar
SuccessExitStatus=143
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now ruoyi-admin
journalctl -u ruoyi-admin -f   # 看日志
```

## 四、Docker / docker-compose 部署

### 4.1 构建镜像

各模块 Dockerfile 基镜像统一为 `bellsoft/liberica-openjdk-rocky:21.0.11-cds`（贝尔实验室 Liberica JDK 21，Spring 官方推荐，CDS 加速启动）。

```bash
# 先 mvn 打包，再各模块目录构建镜像（Dockerfile 用 ADD ./target/xxx.jar，必须在模块根目录构建）
mvn -P prod -DskipTests clean package

cd ruoyi-admin && docker build -t ruoyi/ruoyi-server:5.5.3 .
cd ../ruoyi-extend/ruoyi-monitor-admin   && docker build -t ruoyi/ruoyi-monitor-admin:5.5.3 .
cd ../ruoyi-snailjob-server              && docker build -t ruoyi/ruoyi-snailjob-server:5.5.3 .
cd ../ruoyi-snailai-server               && docker build -t ruoyi/ruoyi-snailai-server:5.5.3 .
```

### 4.2 ruoyi-admin Dockerfile 解析（真实文件）

```dockerfile
FROM bellsoft/liberica-openjdk-rocky:21.0.11-cds
RUN mkdir -p /basic/server/logs /basic/server/temp /basic/skywalking/agent
WORKDIR /ruoyi/server
# 三个端口经 ENV 暴露，可被 compose 的 environment 覆盖
ENV SERVER_PORT=8080 SNAIL_JOB_PORT=28080 SNAIL_AI_PORT=38080 LANG=C.UTF-8 LC_ALL=C.UTF-8 JAVA_OPTS=""
EXPOSE ${SERVER_PORT}
EXPOSE ${SNAIL_JOB_PORT}
EXPOSE ${SNAIL_AI_PORT}
ADD ./target/ruoyi-admin.jar ./app.jar
SHELL ["/bin/bash", "-c"]
ENTRYPOINT java -Djava.security.egd=file:/dev/./urandom -Dserver.port=${SERVER_PORT} \
           -Dsnail-job.port=${SNAIL_JOB_PORT} \
           -Dsnail-ai.port=${SNAIL_AI_PORT} \
           -XX:+HeapDumpOnOutOfMemoryError -XX:+UseZGC ${JAVA_OPTS} \
           -jar app.jar
```

要点：① 临时目录 `/basic/server/temp` 对应 `application-prod.yml` 的 `spring.servlet.multipart.location`，避免上传临时文件被系统清理；② SkyWalking 探针段默认注释，需要 APM 时取消注释 `-javaagent`；③ `${JAVA_OPTS}` 留给 compose 注入堆参数。

### 4.3 docker-compose 编排（核对 script/docker/docker-compose.yml）

真实 compose 用 **`network_mode: "host"`**（所有服务走宿主机网络，端口即宿主机端口，无需 `-p` 映射），核心服务清单：

| service | image | 端口 | 说明 |
|---------|-------|------|------|
| `mysql` | `mysql:8.4.9` | 3306 | 初始库 `ry-vue`，root 密码 `root`，`lower_case_table_names=1`、utf8mb4 |
| `redis` | `redis:8.6.3` | 6379 | 挂 `/docker/redis/conf/redis.conf` |
| `nginx-web` | `nginx:1.31.1` | 80 / 443 | 挂 cert / conf / html / log |
| `minio` | `pgsty/minio:RELEASE.2026-04-17...` | 9000 / 9001 | OSS，账号 `ruoyi` / `ruoyi123` |
| `ruoyi-server1` | `ruoyi/ruoyi-server:5.5.3` | 8080 / 28080 / 38080 | 主应用节点 1 |
| `ruoyi-server2` | `ruoyi/ruoyi-server:5.5.3` | 8081 / 28081 / 38081 | 主应用节点 2（双节点负载）|
| `ruoyi-monitor-admin` | `ruoyi/ruoyi-monitor-admin:5.5.3` | 9090 | 监控中心 |
| `ruoyi-snailjob-server` | `ruoyi/ruoyi-snailjob-server:5.5.3` | 8800 / 17888 | 调度中心（HTTP 8800 + 通信 17888）|
| `ruoyi-snailai-server` | `ruoyi/ruoyi-snailai-server:5.5.3` | 8900 / 18888 | AI server（HTTP 8900 + **gRPC 18888**）|

多节点端口漂移（节点 2 通过 `environment` 覆盖 Dockerfile 默认值）：

```yaml
  ruoyi-server2:
    image: ruoyi/ruoyi-server:5.5.3
    container_name: ruoyi-server2
    environment:
      TZ: Asia/Shanghai
      SERVER_PORT: 8081       # 主端口 +1
      SNAIL_JOB_PORT: 28081   # 客户端端口随漂移
      SNAIL_AI_PORT: 38081
    volumes:
      - /docker/server2/logs/:/basic/server/logs/
    privileged: true
    network_mode: "host"
```

启动：

```bash
cd script/docker
# 先建好挂载目录并放好 redis.conf / nginx.conf / 前端 html / SQL 初始化
docker compose up -d mysql redis nginx-web minio   # 先起基础设施
docker compose up -d ruoyi-snailjob-server ruoyi-snailai-server ruoyi-monitor-admin
docker compose up -d ruoyi-server1 ruoyi-server2   # 最后起主应用
docker compose ps
docker compose logs -f ruoyi-server1
```

> 数据库初始化：`script/docker/database.yml` 是**仅供测试**的 Oracle / SQLServer / PostgreSQL 镜像（生产请自建数据库）。MySQL 初始库由 compose `MYSQL_DATABASE: ry-vue` 创建，建表 SQL 在 `script/sql/`（含 `ry_vue` 业务表、`ry_job.sql` SnailJob 表等），需手动导入。

## 五、外置 server 独立部署

三个外置 server 位于 `ruoyi-extend/`，**与主应用解耦、各自独立打包独立部署**。主应用作为它们的"客户端"通过 application-prod.yml 里的开关与地址接入。

### 5.1 ruoyi-monitor-admin（监控中心 · Spring Boot Admin）

- Dockerfile：基镜像 JDK 21，`WORKDIR /ruoyi/monitor`，`EXPOSE 9090`，ZGC 启动。
- 主应用接入：`application-prod.yml` 的 `spring.boot.admin.client.enabled` 默认 `false`，需接入时改 `true` 并设 `url: http://<monitor-host>:9090/admin`，账号密码来自 pom profile 的 `monitor.username/password`。
- Nginx 暴露：`/admin/` → `monitor-admin (9090)`。

### 5.2 ruoyi-snailjob-server（分布式任务调度中心）

- Dockerfile：`WORKDIR /ruoyi/snailjob`，`EXPOSE 8800`（控制台 HTTP）+ `EXPOSE 17888`（与客户端通信端口）。
- 主应用接入：`snail-job.enabled`（默认 false）、`group: ruoyi_group`、`token`（与 `sj_group_config` 表一致）、`server.host/port: 127.0.0.1:17888`、`namespace`（与 `sj_namespace.unique_id` 一致）。
- 需导入 `script/sql/ry_job.sql` 初始化 SnailJob 元数据表。

### 5.3 ruoyi-snailai-server（SnailAI server · 注意双端口）

- Dockerfile：`WORKDIR /ruoyi/snailai`，`EXPOSE 8900`（HTTP / OpenAPI）+ **`EXPOSE 18888`（gRPC）**。
- 主应用接入（application-prod.yml `snail-ai`，默认 `enabled: false`）：
  - `server.host/port: 127.0.0.1:18888` → 连 server 端 **gRPC 18888**
  - `open-api.web-port: 8900` → server **HTTP 8900**
  - `app-id` / `token` 在 server「应用管理」页创建后填入
- Nginx 暴露：`/snail-ai/` → `snailai-server (8900)`；gRPC 18888 不走 Nginx HTTP 反代，按需直连或单独配置 stream。

> 区分牢记：**gRPC = 18888，HTTP/OpenAPI = 8900**。两者用途不同，防火墙都要放行（8900 给前端 / 反代，18888 给主应用 gRPC 调用）。

独立启动外置 server 示例：

```bash
java -XX:+UseZGC -jar ruoyi-snailai-server.jar --spring.profiles.active=prod
java -XX:+UseZGC -jar ruoyi-snailjob-server.jar --spring.profiles.active=prod
java -XX:+UseZGC -jar ruoyi-monitor-admin.jar --spring.profiles.active=prod
```

## 六、Nginx 反向代理（核对 nginx/conf/nginx.conf）

真实 nginx.conf 关键配置：

```nginx
http {
    client_max_body_size 100m;          # 与上传大小一致
    gzip_static on;
    server_tokens off;                  # 隐藏版本号

    upstream server {                   # 主应用负载（ip_hash 保持会话）
        ip_hash;
        server 127.0.0.1:8080;
        server 127.0.0.1:8081;
    }
    upstream monitor-admin  { server 127.0.0.1:9090; }
    upstream snailjob-server { server 127.0.0.1:8800; }
    upstream snailai-server  { server 127.0.0.1:8900; }

    server {
        listen 80;
        # 限制外网访问 actuator（安全）
        location ~ ^(/[^/]*)?/actuator.*(/.*)?$ { return 403; }

        location / {                    # 前端静态资源
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }
        location /prod-api/ {           # 后端 API（注意 SSE/WebSocket 支持）
            proxy_set_header Host $http_host;
            proxy_read_timeout 86400s;  # 长连接/SSE 24h
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_buffering off;
            proxy_pass http://server/;
        }
        location /admin/    { proxy_pass http://monitor-admin/admin/; }
        location /snail-job/{ proxy_pass http://snailjob-server/snail-job/; }
        location /snail-ai/ { proxy_pass http://snailai-server/snail-ai/; }
    }
}
```

要点：① 前端 API 前缀 **`/prod-api/`**（前端 `.env.production` 的 `VITE_APP_BASE_API` 须对应）；② `/prod-api/`、`/snail-job/`、`/snail-ai/` 都配了 `proxy_buffering off` + `Upgrade/Connection` 头，**SSE（AI 流式）和 WebSocket 才不会断**；③ `actuator` 路径直接 403，防止外网探测；④ HTTPS：模板里 443 + `ssl_certificate` 段已注释，证书丢 `/docker/nginx/cert/` 后取消注释即可，仅支持 TLSv1.2/1.3。

## 七、生产配置与密钥安全（application-prod.yml）

源码里的密钥都是**演示默认值**，上线**必须全部替换**，且不得提交到仓库（用环境变量 / 配置中心 / `${ENV:default}` 注入）。

### 7.1 必改清单

| 项 | 源码默认（演示值，禁止上线沿用） | 文件位置 |
|----|--------------------------------|---------|
| MySQL 密码 | `username: root` / `password: root` | application-prod.yml 数据源 |
| Redis 密码 | `password: ruoyi123`（必须配置，不可空）| application-prod.yml `spring.data.redis` |
| MinIO 账号 | `ruoyi` / `ruoyi123` | docker-compose.yml minio |
| Sa-Token JWT 密钥 | `jwt-secret-key: abcdefghijklmnopqrstuvwxyz` | application.yml `sa-token` |
| API 加密 RSA 公私钥 | `api-decrypt.publicKey/privateKey`（内置一对）| application.yml |
| MyBatis 字段加密 | `mybatis-encryptor` 公私钥 | application.yml |
| monitor 账号密码 | `ruoyi` / `123456`（pom profile）| 根 pom `<profiles>` |
| SnailJob token | `SJ_cKqBTPzCsWA3...` | application-prod.yml `snail-job.token` |
| SnailAI token | `SAI_566a6bfbc26...` | application-prod.yml `snail-ai.token` |
| 三方登录 client-secret | justauth 各平台 | application-prod.yml `justauth` |

### 7.2 用环境变量注入（推荐，不硬编码）

application-prod.yml 支持 `${ENV:default}` 占位，改成从环境变量读：

```yaml
spring:
  datasource:
    dynamic:
      datasource:
        master:
          url: ${DB_URL:jdbc:mysql://localhost:3306/ry-vue?...&serverTimezone=GMT%2B8...}
          username: ${DB_USER:root}
          password: ${DB_PASSWORD:root}
spring.data:
  redis:
    host: ${REDIS_HOST:localhost}
    password: ${REDIS_PASSWORD:}
```

容器里通过 compose `environment` 注入：

```yaml
  ruoyi-server1:
    image: ruoyi/ruoyi-server:5.5.3
    environment:
      SPRING_PROFILES_ACTIVE: prod      # profile 切换核心
      DB_PASSWORD: "你的强密码"
      REDIS_PASSWORD: "你的强密码"
      JAVA_OPTS: "-Xms1g -Xmx2g"
    network_mode: "host"
```

### 7.3 profile 切换（SPRING_PROFILES_ACTIVE）

优先级：环境变量 `SPRING_PROFILES_ACTIVE` > 启动参数 `--spring.profiles.active` > jar 内默认。生产一律 `prod`：

```bash
export SPRING_PROFILES_ACTIVE=prod && java -jar ruoyi-admin.jar
# 或
java -jar ruoyi-admin.jar --spring.profiles.active=prod
```

## 八、常见错误对比（错误 vs 正确）

| 场景 | 错误做法 | 正确做法 |
|------|---------|---------|
| 运行环境 | 用 JDK 8/17 启动 jar，报 `UnsupportedClassVersionError` | 必须 **JDK 21**（Spring Boot 4 要求），镜像用 Liberica 21 |
| 容器认知 | 以为是 war 包丢 Tomcat / 找 `server.tomcat.*` 调优 | 是 **Jetty** 可执行 fat jar，调优用 `server.jetty.*`，直接 `java -jar` |
| 制品名 | Dockerfile 里 `ADD ruoyi-admin-5.5.3.jar` | 产物固定 `ruoyi-admin.jar`（`finalName`），Dockerfile 用 `ADD ./target/ruoyi-admin.jar` |
| 密钥 | 直接用源码默认 JWT/RSA/数据库密码上线 | 全部替换为强随机值，用环境变量注入，**不提交仓库** |
| profile | 生产仍跑默认 dev（日志 info、密钥演示值）| 显式 `SPRING_PROFILES_ACTIVE=prod` |
| SnailAI 端口 | 把 gRPC 18888 当 HTTP，或反代 18888 给前端 | gRPC=18888（主应用直连），HTTP=8900（前端/Nginx）|
| SSE 流式 | Nginx 默认 `proxy_buffering on`，AI 流式无响应 | `/prod-api/`、`/snail-ai/` 加 `proxy_buffering off` + Upgrade 头 |
| Redis | 不配密码或留空 | application-prod.yml 注释明确"redis 密码必须配置"，务必设密码 |
| actuator | 直接暴露 `/actuator` 到外网 | Nginx `location ~ actuator { return 403; }` 拦截 |

## 九、最佳实践

1. **构建一次，多环境部署**：同一个 jar 通过 `SPRING_PROFILES_ACTIVE` 切 dev/test/prod，不为每个环境重打包；环境差异全走环境变量。
2. **密钥零硬编码**：JWT、RSA、数据库 / Redis 密码、第三方 secret 一律 `${ENV}` 注入或接入配置中心，`.gitignore` 排除真实密钥文件，源码只留演示占位。
3. **主应用多节点 + ip_hash**：双节点 8080/8081，Nginx `upstream` 用 `ip_hash` 保持会话；端口漂移规则（SnailJob `2${server.port}`、SnailAI `38080+`）让每节点端口不冲突。
4. **外置 server 按需启用**：monitor/snailjob/snailai 在 application-prod.yml 默认 `enabled: false`，用到才开，并先导入对应 SQL（`ry_job.sql` 等）和后台创建组 / 应用拿 token。
5. **JVM 统一 ZGC**：所有 Dockerfile 已用 `-XX:+UseZGC -XX:+HeapDumpOnOutOfMemoryError`，裸机部署保持一致，dump 目录映射出来便于排障。
6. **日志与临时目录外挂**：compose 把 `/basic/server/logs`、`temp` 映射到宿主机，便于收集和清理；上传临时目录与 `multipart.location` 一致避免清理报错。
7. **HTTPS 与 actuator 收口**：生产启 443 + 证书，actuator 一律 Nginx 403，`server_tokens off` 隐藏版本，`client_max_body_size` 与后端上传上限对齐（默认 100m）。
8. **数据库初始化顺序**：先建库导 SQL（业务表 + SnailJob 表 + 字典 / 菜单数据），再起主应用；MySQL 必须 `lower_case_table_names=1` + utf8mb4，与 compose 一致，否则表名大小写问题导致启动失败。
9. **部署前自检**：确认 JDK 21、profile=prod、密钥已换、Redis 有密码、外置 server 地址 / 端口（8900 HTTP / 18888 gRPC）填对、Nginx `/prod-api/` 前缀与前端 `VITE_APP_BASE_API` 匹配。

## 十、参考源文件

- 根 `pom.xml`：JDK 21、Spring Boot 4.1.0、`revision=5.5.3`、profiles（local/dev/prod）、packaging=pom
- `ruoyi-common/ruoyi-common-web/pom.xml`：排除 Tomcat、引入 Jetty
- `ruoyi-admin/pom.xml`：`spring-boot-maven-plugin` repackage、`finalName=ruoyi-admin`
- `ruoyi-admin/Dockerfile`：JDK 21 镜像、三端口、ZGC、`ruoyi-admin.jar`
- `ruoyi-extend/ruoyi-monitor-admin|ruoyi-snailjob-server|ruoyi-snailai-server/Dockerfile`：各外置 server 端口（9090 / 8800+17888 / 8900+18888）
- `script/docker/docker-compose.yml`：MySQL/Redis/Nginx/MinIO + 双主应用 + 三外置 server 编排
- `script/docker/nginx/conf/nginx.conf`：反向代理 /prod-api、/admin、/snail-job、/snail-ai
- `ruoyi-admin/src/main/resources/application-prod.yml`：数据源、Redis、SnailJob、SnailAI 生产配置
- `ruoyi-admin/src/main/resources/application.yml`：Sa-Token JWT 密钥、API/MyBatis 加密 RSA 公私钥
