---
name: env-config
description: |
  base-dev-framework6-java多环境配置技能。指导后端 Spring Boot 多 profile
  （application.yml 公共 + application-dev.yml / application-prod.yml 环境特定）的组织、切换、
  外部环境变量覆盖与生产敏感配置脱密。包名 org.dromara，不涉及前端（前端在仓库内 `frontend/plus-ui/`，其 `.env` 配置见前端工程）。

  触发场景：
  - 需要配置/区分开发环境与生产环境（application-dev.yml / application-prod.yml）
  - 需要切换 spring.profiles.active 或通过 SPRING_PROFILES_ACTIVE 切换运行环境
  - 需要用 ${ENV_VAR:default} 把数据库/Redis 密码、JWT/加密密钥外置为环境变量
  - 需要理解 Maven profile（local/dev/prod）与 Spring profile 的 @profiles.active@ 联动
  - 排查"配置在哪改"、"为什么生产环境读到了开发的值"、"占位符没被替换"等问题
  - 需要开关各模块功能段（snail-ai.enabled / easy-es.enable / message.enabled / mybatis-plus.sql-log.enabled）

  触发词：环境配置、profile、application.yml、application-dev.yml、application-prod.yml、
  多环境、环境变量、SPRING_PROFILES_ACTIVE、开发环境、生产环境、测试环境、配置切换、
  占位符、外部配置、@profiles.active@、${ENV:default}、profiles.active、数据源配置、
  Redis 配置、敏感配置、密钥外置、配置覆盖
---

# 多环境配置（env-config）

> 适用框架：**base-dev-framework6-java（包名 `org.dromara`）**
> 适用目录：`backend/java/ruoyi-admin/src/main/resources/`、各 `ruoyi-common-*/src/main/resources/`、根 `pom.xml`
> 本技能**只覆盖后端**。前端（plus-ui，仓库内 `frontend/plus-ui/` 目录）的 `.env` 配置不在本技能范围内。

---

## 1. 概述

本项目 采用标准的 **Spring Boot 多 profile** 机制做多环境配置，核心思路是
"公共配置 + 环境特定配置"两层叠加：

| 文件 | 角色 | 内容 |
|------|------|------|
| `application.yml` | **公共配置**（所有环境共享） | 端口、验证码、Sa-Token、MyBatis-Plus、接口加密、XSS、消息推送、工作流、MCP 等与环境无关的配置 |
| `application-dev.yml` | **开发环境特定** | 数据源、Redis、邮件、短信、三方授权、snail-job/snail-ai、SQL 日志开关 |
| `application-prod.yml` | **生产环境特定** | 同上，但连接池更大、SQL 日志关闭、临时目录指向 `/basic/server/temp` |

启用哪个环境，由 `application.yml` 里这一行决定：

```yaml
spring:
  profiles:
    active: @profiles.active@   # 该占位符在打包时由 Maven 替换为 local/dev/prod
```

> 关键事实（已核对源码）：
> - 仓库里**实际只有** `application-dev.yml` 与 `application-prod.yml` 两个环境文件，**没有** `application-local.yml`，但 `pom.xml` 里有 `local` profile。若用 `-Plocal` 打包，`profiles.active` 会变成 `local`，而没有对应的 `application-local.yml` —— 此时 Spring 找不到该 profile 的特定文件，等价于"只加载公共配置 + 任何 active 在文件名后缀的段"。新项目要用 local 环境需自己补 `application-local.yml`。
> - `application.yml` 顶部注释虽写"开发环境配置"，但它实质是**公共配置**，环境差异部分都拆到了 `-dev/-prod` 里。

---

## 2. profile 文件结构与加载顺序

### 2.1 三个文件的物理位置

```
backend/java/ruoyi-admin/src/main/resources/
├── application.yml          # 公共配置（含 profiles.active 与所有环境无关项）
├── application-dev.yml      # 开发环境：数据源 / Redis / 邮件 / 短信 / 三方授权 / 各开关
├── application-prod.yml     # 生产环境：同结构，连接池更大、日志更省、临时目录可写
├── banner.txt               # 启动 Banner
├── logback-plus.xml         # 日志框架配置（被 application.yml 的 logging.config 引用）
└── i18n/messages*.properties # 国际化资源（被 spring.messages.basename 引用）
```

此外，**公共模块也带配置片段**，会被 Spring Boot 自动合并：

```
backend/java/ruoyi-common/ruoyi-common-mybatis/src/main/resources/common-mybatis.yml   # MyBatis-Plus 内置项
backend/java/ruoyi-common/ruoyi-common-satoken/src/main/resources/common-satoken.yml   # Sa-Token 内置项
```

> 这两个 `common-*.yml` 文件头都写着"**内置配置 不允许修改 如需修改请在 nacos 上写相同配置覆盖**"。
> 改环境配置时**不要动**它们，要覆盖请在 `application.yml` / `application-{env}.yml` 里写同名键覆盖。

### 2.2 加载与覆盖优先级（从低到高）

1. `common-mybatis.yml` / `common-satoken.yml`（公共模块内置项）
2. `application.yml`（公共配置）
3. `application-{active}.yml`（当前激活环境，**同名键覆盖上面**）
4. **外部环境变量 / JVM `-D` 参数 / 命令行 `--key=value`（最高，覆盖一切文件值）**

理解这条优先级是排查"为什么生产读到开发值"的根本：高优先级覆盖低优先级，文件里写啥不重要，**最终生效值看最高优先级来源**。

### 2.3 多文档块（`---`）写法

`application.yml` 与 `application-{env}.yml` 大量使用 YAML 的 `---` 分隔符把不同关注点拆成多个文档块（同一文件内）：

```yaml
--- # 数据源配置
spring:
  datasource: ...

--- # redis 单机配置(单机与集群只能开启一个另一个需要注释掉)
spring.data:
  redis: ...

--- # mail 邮件发送
mail:
  enabled: false
```

这些 `---` 块**属于同一 profile**（同一个文件），不是 profile 切换；只是逻辑分组，便于阅读。

---

## 3. Maven profile 与 Spring profile 的联动（核心机制）

这是 本项目配置体系**最容易绕晕的地方**：环境名既出现在 Maven，又出现在 Spring，两者通过**资源过滤（resource filtering）占位符 `@...@`** 联动。

### 3.1 Maven 端：`pom.xml` 的三个 profile

```xml
<!-- 根 pom.xml（已核对源码，行 80-114） -->
<profiles>
    <profile>
        <id>local</id>
        <properties>
            <!-- 环境标识，需要与配置文件的名称相对应 -->
            <profiles.active>local</profiles.active>
            <logging.level>info</logging.level>
            <monitor.username>ruoyi</monitor.username>
            <monitor.password>123456</monitor.password>
        </properties>
    </profile>
    <profile>
        <id>dev</id>
        <properties>
            <profiles.active>dev</profiles.active>
            <logging.level>info</logging.level>
            <monitor.username>ruoyi</monitor.username>
            <monitor.password>123456</monitor.password>
        </properties>
        <activation>
            <!-- 默认环境 -->
            <activeByDefault>true</activeByDefault>
        </activation>
    </profile>
    <profile>
        <id>prod</id>
        <properties>
            <profiles.active>prod</profiles.active>
            <logging.level>warn</logging.level>
            <monitor.username>ruoyi</monitor.username>
            <monitor.password>123456</monitor.password>
        </properties>
    </profile>
</profiles>
```

要点：
- **dev 是默认 profile**（`activeByDefault=true`），不带 `-P` 参数打包就是 dev。
- 每个 Maven profile 定义了 4 个属性：`profiles.active`、`logging.level`、`monitor.username`、`monitor.password`。
- `prod` 与 dev 的差异只在 `logging.level`（dev=info、prod=warn）。

### 3.2 Spring 端：用 `@...@` 占位符接收 Maven 属性

Spring 配置文件里用 **`@属性名@`**（注意是 `@@` 不是 `${}`）来引用 Maven 属性，打包时被 maven-resources-plugin 替换为真实值：

```yaml
# application.yml（已核对源码）
spring:
  profiles:
    active: @profiles.active@      # → 被替换为 local / dev / prod

logging:
  level:
    org.dromara: @logging.level@   # → dev=info, prod=warn
```

```yaml
# application-dev.yml / application-prod.yml（监控中心配置块）
spring.boot.admin.client:
  username: @monitor.username@     # → ruoyi
  password: @monitor.password@     # → 123456
```

### 3.3 联动全流程

```
mvn package -Pprod
        │
        ▼
Maven 激活 prod profile → profiles.active=prod, logging.level=warn
        │
        ▼
maven-resources-plugin 把 @profiles.active@ 替换为 prod、@logging.level@ 替换为 warn
        │
        ▼
打进 jar 的 application.yml 里 spring.profiles.active: prod
        │
        ▼
Spring 启动时读到 active=prod → 额外加载 application-prod.yml
```

> 一句话：**Maven profile 决定"打包时把 `@profiles.active@` 替换成谁"，从而决定 Spring 启动时激活哪个 profile**。两者必须同名（local/dev/prod 一一对应配置文件后缀）。

> 注意 `@...@` 与 `${...}` 的本质区别：
> - `@xxx@` —— **构建期**（Maven 打包时）替换，值来自 `pom.xml` 的 `<properties>`，替换后写进 jar。源码态（IDE 里直接看）是未替换的字面量 `@profiles.active@`。
> - `${xxx}` —— **运行期**替换，由 Spring 解析，值来自环境变量 / 系统属性 / 其它配置项。

---

## 4. 占位符与外部环境变量覆盖

### 4.1 `${VAR}` 与 `${VAR:default}` 语法

Spring 在**运行期**解析 `${...}`，支持默认值兜底：

| 写法 | 含义 |
|------|------|
| `${REDIS_HOST}` | 读环境变量 `REDIS_HOST`，未设置则报错（无兜底） |
| `${REDIS_HOST:localhost}` | 读环境变量 `REDIS_HOST`，未设置时用默认值 `localhost` |
| `${spring.application.name}` | 引用同配置体系内的另一个键（配置内互相引用） |

源码中**已有的运行期 `${}` 引用**（均为配置项互引，非环境变量，已核对）：

```yaml
# application.yml
snail-job:
  namespace: ${spring.profiles.active}   # 复用当前激活的 profile 名做命名空间
  port: 2${server.port}                  # 在端口号前拼 2，随主端口漂移

warm-flow:
  token-name: ${sa-token.token-name},clientid

api-decrypt:
  # 引用 ${project.version} 等
springdoc:
  info:
    version: '版本号: ${project.version}'
```

> 现状提醒：**框架 dev/prod 配置里，数据库密码、Redis 密码、JWT 密钥等敏感值默认是写死的明文**（见第 5 节）。要做生产脱密，需要**自己把这些明文改成 `${ENV_VAR:default}` 形式**，这是本技能推荐的标准改造（第 6 节给出范例）。

### 4.2 外部覆盖的三种入口（优先级递增）

不改任何文件，就能在启动时覆盖配置：

```bash
# 1) 环境变量（推荐生产用，配合 ${ENV:default} 占位符）
export SPRING_PROFILES_ACTIVE=prod
export DATABASE_PASSWORD=真实生产密码
java -jar ruoyi-admin.jar

# 2) JVM 系统属性 -D（点号路径，全大写下划线也可）
java -Dspring.profiles.active=prod -Dspring.data.redis.password=xxx -jar ruoyi-admin.jar

# 3) 命令行参数 --（优先级最高）
java -jar ruoyi-admin.jar --spring.profiles.active=prod --server.port=8080
```

> 环境变量名映射规则（Spring Boot relaxed binding）：配置键 `spring.data.redis.password` 对应环境变量 `SPRING_DATA_REDIS_PASSWORD`（点/中划线→下划线，全大写）。

---

## 5. 关键配置段速查

下面是排查/修改时最常碰的配置段，标注**在哪个文件、dev 与 prod 的差异、对应开关**。

### 5.1 数据源（在 `application-dev.yml` / `application-prod.yml`）

```yaml
spring:
  datasource:
    type: com.zaxxer.hikari.HikariDataSource
    dynamic:                       # dynamic-datasource 多数据源
      primary: master
      strict: true                 # 严格模式：匹配不到数据源直接报错
      datasource:
        master:
          driverClassName: com.mysql.cj.jdbc.Driver
          url: jdbc:mysql://localhost:3306/ry-vue?...&serverTimezone=GMT%2B8&...
          username: root
          password: root           # ← 生产必须外置（见第 6 节）
      hikari:
        maxPoolSize: 20            # dev 与 prod 相同为 20
        minIdle: 10
```

> Oracle / PostgreSQL / SQLServer / 从库 slave 的配置块在文件里以**注释形式**预留，需要时取消注释即可。

### 5.2 Redis（在 `application-dev.yml` / `application-prod.yml`）

```yaml
spring.data:
  redis:
    host: localhost
    port: 6379
    database: 0
    password: ruoyi123             # ← 注释明确写"redis 密码必须配置"，生产须外置
    timeout: 10s
    ssl.enabled: false
```

redisson 连接池在 dev 与 prod **不同**（生产更大）：

| 项 | dev | prod |
|----|-----|------|
| `redisson.threads` | 4 | 16 |
| `redisson.nettyThreads` | 8 | 32 |
| `connectionMinimumIdleSize` | 8 | 32 |
| `connectionPoolSize` | 32 | 64 |

### 5.3 各模块功能开关（最常被问"在哪开/关"）

| 开关键 | 所在文件 | dev 默认 | prod 默认 | 含义 |
|--------|---------|---------|----------|------|
| `mybatis-plus.sql-log.enabled` | `application-dev/prod.yml` | **true** | **false** | 完整 SQL 输出；dev 开方便调试，prod 关省日志 |
| `snail-ai.enabled` | `application-dev/prod.yml` | false | false | snail-ai 客户端模式 |
| `snail-job.enabled` | `application-dev/prod.yml` | false | false | snail-job 分布式任务 |
| `easy-es.enable` | `application.yml`（公共） | false | false | easy-es / Elasticsearch 自动配置（注意键名是 `enable` 不是 `enabled`） |
| `message.enabled` | `application.yml`（公共） | true | true | 统一消息推送（SSE/WebSocket） |
| `mqtt.client.enabled` | `application.yml`（公共） | false | false | MQTT 客户端 |
| `warm-flow.enabled` | `application.yml`（公共） | true | true | warm-flow 工作流 |
| `mail.enabled` | `application-dev/prod.yml` | false | false | 邮件发送 |
| `captcha.enable` | `application.yml`（公共） | true | true | 验证码校验（注意键名 `enable`） |
| `xss.enabled` | `application.yml`（公共） | true | true | XSS 过滤 |
| `api-decrypt.enabled` | `application.yml`（公共） | true | true | 全局接口加密 |
| `mybatis-encryptor.enable` | `application.yml`（公共） | false | false | 字段级数据加密（键名 `enable`） |

> 易踩坑：**键名一会儿 `enabled` 一会儿 `enable`**，由各 starter 自身定义决定，照抄源码键名，别想当然改。

### 5.4 公共模块内置项（不要改，必要时覆盖）

- `common-mybatis.yml`：`mybatis-plus.global-config.dbConfig.logicDeleteValue=1` / `logicNotDeleteValue=0`、`idType: ASSIGN_ID`（雪花 ID）。
- `common-satoken.yml`：`sa-token.token-prefix: "Bearer"`、`is-read-cookie: false`（杜绝 CSRF）。

---

## 6. 生产敏感配置脱密（强制实践）

### 6.1 原则

- **绝不**把生产的数据库密码、Redis 密码、JWT/加密密钥等以明文提交到 Git。
- 生产敏感值一律走**环境变量**，配置文件里只留 `${ENV_VAR:开发默认值}` 占位。
- 框架 dev/prod 里这些值默认是明文（`password: root`、`password: ruoyi123`、`jwt-secret-key: abcdefghijklmnopqrstuvwxyz`、`api-decrypt` 的公私钥），**上生产前必须改**。

### 6.2 需要外置的敏感清单（已核对源码）

| 配置项 | 源码默认（明文） | 所在文件 |
|--------|-----------------|---------|
| 数据库密码 `spring.datasource.dynamic.datasource.master.password` | `root` | `application-{env}.yml` |
| 数据库用户名 / URL | `root` / `localhost:3306/ry-vue` | `application-{env}.yml` |
| Redis 密码 `spring.data.redis.password` | `ruoyi123` | `application-{env}.yml` |
| Sa-Token JWT 密钥 `sa-token.jwt-secret-key` | `abcdefghijklmnopqrstuvwxyz` | `application.yml` |
| 接口加密公私钥 `api-decrypt.publicKey/privateKey` | 内置 RSA 明文 | `application.yml` |
| 字段加密密钥 `mybatis-encryptor.password` | 空（启用后须填） | `application.yml` |
| 邮件 `mail.pass`、短信 `sms.blends.*.access-key-secret` | 占位 `xxx` | `application-{env}.yml` |
| 三方授权 `justauth.type.*.client-secret` | 占位 | `application-{env}.yml` |

### 6.3 改造范例（把明文改成环境变量占位）

```yaml
# 改造前（application-prod.yml，危险，明文进 Git）
master:
  url: jdbc:mysql://localhost:3306/ry-vue?...
  username: root
  password: root

# 改造后（推荐，敏感值走环境变量，默认值仅供本地兜底）
master:
  url: jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3306}/${DB_NAME:ry-vue}?useUnicode=true&characterEncoding=utf8&serverTimezone=GMT%2B8&...
  username: ${DB_USERNAME:root}
  password: ${DB_PASSWORD:root}
```

```yaml
# Redis 密码外置
spring.data:
  redis:
    host: ${REDIS_HOST:localhost}
    port: ${REDIS_PORT:6379}
    password: ${REDIS_PASSWORD:ruoyi123}
```

```yaml
# Sa-Token JWT 密钥外置（生产必须换成强随机值，绝不用源码默认值）
sa-token:
  jwt-secret-key: ${SATOKEN_JWT_SECRET:abcdefghijklmnopqrstuvwxyz}
```

部署侧（生产机）只需注入环境变量，**不动 jar、不动配置文件**：

```bash
export SPRING_PROFILES_ACTIVE=prod
export DB_HOST=10.0.0.5
export DB_PASSWORD=生产强密码
export REDIS_PASSWORD=生产Redis强密码
export SATOKEN_JWT_SECRET=生产环境强随机密钥
java -jar ruoyi-admin.jar
```

Docker / docker-compose 中用 `environment:` 段注入同名变量即可。

---

## 7. 切换环境的几种方式

| 场景 | 操作 | 说明 |
|------|------|------|
| **本地 IDEA 跑** | 直接运行 `DromaraApplication`（dev 为默认 profile） | 不带任何参数即 dev |
| **打包指定环境** | `mvn clean package -Pprod` | Maven 激活 prod，替换 `@profiles.active@` 为 prod |
| **运行时临时切环境（不重新打包）** | `java -jar app.jar --spring.profiles.active=prod` | 命令行参数覆盖 jar 内值 |
| **环境变量切换（容器/CI 推荐）** | `export SPRING_PROFILES_ACTIVE=prod` 后启动 | 优先级高于配置文件，适合 K8s/Docker |
| **IDEA 临时切 profile** | Run Configuration → Active profiles 填 `prod` | 等价 `-Dspring.profiles.active=prod` |

> **`SPRING_PROFILES_ACTIVE`（环境变量）= `spring.profiles.active`（配置键）= `--spring.profiles.active`（命令行）**，三者是同一回事的不同入口，按第 2.2 节优先级覆盖文件里的 `@profiles.active@` 替换结果。

---

## 8. 排查指南

### 8.1 "配置在哪改？"

按这个顺序定位：

1. 是否**环境无关**（端口、Sa-Token、加密、XSS、消息、工作流）→ 改 `application.yml`。
2. 是否**环境特定**（数据源、Redis、邮件、短信、三方授权、SQL 日志开关）→ 改 `application-dev.yml` 或 `application-prod.yml`（看你跑哪个环境）。
3. 是否**公共模块内置项**（MyBatis-Plus 全局、Sa-Token 前缀）→ 在 `common-*.yml`，**不要直接改**，在 `application.yml` 写同名键覆盖。
4. 生产敏感值 → 不在文件里写死，走环境变量（第 6 节）。

### 8.2 "为什么生产环境读到了开发的值？"

按优先级（第 2.2 节）逐层排查，常见原因：

1. **打包时 profile 没切对**：用了默认 dev（`mvn package` 不带 `-Pprod`），打进 jar 的 `profiles.active` 是 dev → `application-prod.yml` 根本没加载。**核对**：解包看 jar 内 `application.yml` 的 `spring.profiles.active` 实际被替换成了啥。
2. **运行时被覆盖**：启动命令带了 `--spring.profiles.active=dev` 或机器上有 `SPRING_PROFILES_ACTIVE=dev` 环境变量，覆盖了 jar 内的 prod。**核对**：`echo $SPRING_PROFILES_ACTIVE`、看启动脚本/启动参数。
3. **prod 文件里某段没覆盖**：`application-prod.yml` 没写某个键，于是回退到 `application.yml`（公共）或公共模块默认值。**核对**：确认该键是否真的在 prod 文件里有一份。
4. **环境变量缺失但有默认值**：用了 `${DB_PASSWORD:root}` 但生产没设 `DB_PASSWORD`，于是用了默认 `root`。**核对**：`env | grep DB_`。

> 最快验证生效值：启动后访问 Actuator（`management.endpoints.web.exposure.include: '*'` 已开），`/actuator/env` 能看到每个配置项的**最终来源与值**，一眼看出是被哪层覆盖的。

### 8.3 "`@profiles.active@` 占位符没被替换（启动报错 active=@profiles.active@）"

原因：**没经过 Maven 资源过滤**就直接跑了源码态文件。

- 触发场景：IDE 直接读 `src/main/resources` 的原始文件、或 build 工具没配 resource filtering。
- 解法：用 `mvn` 构建一次（resource filtering 由 spring-boot-starter-parent 的默认配置启用），或在 IDE 里执行一次 Maven 的 `process-resources`。本项目默认已配好过滤，正常 `mvn` 流程不会出问题；出问题多半是绕过了 Maven。

---

## 9. 常见错误对比

### 错误 1：把敏感值明文留在 prod 文件并提交 Git

```yaml
# ❌ 错误：生产密码明文进版本库，泄露风险极高
master:
  password: MyRealProdPassw0rd!
```

```yaml
# ✅ 正确：走环境变量，文件里不出现真值
master:
  password: ${DB_PASSWORD:root}   # 真值在部署机 export DB_PASSWORD=...
```

### 错误 2：混淆 `@@` 与 `${}`

```yaml
# ❌ 错误：把 Maven 构建期属性写成运行期占位，Spring 找不到 profiles.active 这个属性
spring:
  profiles:
    active: ${profiles.active}    # 运行期没有这个值 → 报错或为空

# ✅ 正确：Maven 属性用 @@（构建期替换）
spring:
  profiles:
    active: @profiles.active@
```

反过来，环境变量该用 `${}` 却写成 `@@` 也错——`@DB_PASSWORD@` 不会被 Maven 替换（pom 里没这个属性），更不会被 Spring 解析，会原样当成字面量。

### 错误 3：去改 `common-mybatis.yml` / `common-satoken.yml`

```yaml
# ❌ 错误：直接改公共模块内置文件（文件头明确写"不允许修改"）
# common-satoken.yml
sa-token:
  token-prefix: "Token"   # 改这里会影响所有引入该模块的服务，且升级被覆盖

# ✅ 正确：在 application.yml 写同名键覆盖
# application.yml
sa-token:
  token-prefix: "Token"
```

### 错误 4：以为 `local` 环境开箱即用

```bash
# ❌ 误区：mvn package -Plocal 后以为会加载 application-local.yml
#    但仓库里没有 application-local.yml，只会加载公共配置，数据源等可能缺失

# ✅ 正确：要用 local 环境，先自建 application-local.yml（复制 dev 改差异），再 -Plocal
```

---

## 10. 最佳实践

1. **公共与环境分离**：环境无关项只写 `application.yml`；只在环境间有差异的才放 `application-{env}.yml`，避免重复维护。
2. **dev 默认、prod 显式**：dev 是 `activeByDefault`，本地零参数即跑；生产**显式** `-Pprod` 打包 + `SPRING_PROFILES_ACTIVE=prod` 双保险。
3. **敏感值零明文进库**：所有密码/密钥用 `${ENV:default}` 外置，默认值仅供本地，生产靠环境变量注入；JWT、接口加密、字段加密密钥**生产必须换成强随机值**，绝不沿用源码默认。
4. **改前先查优先级**：改不生效先想第 2.2 节优先级——很可能被更高优先级（环境变量/命令行）覆盖了。
5. **键名照抄源码**：`enable` vs `enabled`、`easy-es.enable`、`captcha.enable`、`mybatis-encryptor.enable` 不统一，以源码为准，别凭直觉补 `d`。
6. **生产关 SQL 日志**：`mybatis-plus.sql-log.enabled` 在 prod 保持 `false`（dev 才开），避免日志量爆炸与潜在敏感数据落盘。
7. **善用 Actuator 验证**：`/actuator/env` 是确认"某项最终值与来源"的权威手段，比肉眼读 yml 更可靠。
8. **不动公共模块内置 yml**：`common-mybatis.yml` / `common-satoken.yml` 一律靠 `application*.yml` 同名键覆盖，保证升级源框架时不冲突。
9. **包名始终 `org.dromara`**：扫描包、mapper 包等路径以 `org.dromara` 为准（如 `mybatis-plus.mapperPackage: org.dromara.**.mapper`），不要出现 `com.ruoyi` / `plus.ruoyi` 之类旧包名。

---

## 附：本技能引用的真实源文件

- `backend/java/ruoyi-admin/src/main/resources/application.yml`（公共配置、`@profiles.active@`、各开关）
- `backend/java/ruoyi-admin/src/main/resources/application-dev.yml`（开发环境：数据源/Redis/SQL 日志开关）
- `backend/java/ruoyi-admin/src/main/resources/application-prod.yml`（生产环境：连接池更大/SQL 日志关/临时目录）
- `backend/java/ruoyi-common/ruoyi-common-mybatis/src/main/resources/common-mybatis.yml`（MyBatis-Plus 内置项）
- `backend/java/ruoyi-common/ruoyi-common-satoken/src/main/resources/common-satoken.yml`（Sa-Token 内置项）
- `pom.xml`（profiles：local/dev/prod 与 `profiles.active`/`logging.level`/`monitor.*` 属性）
