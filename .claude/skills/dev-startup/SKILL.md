---
name: dev-startup
description: |
  当需要在本地从零搭建后端开发环境、首次把本项目跑起来、安装运行时依赖、排查启动失败时自动使用此 Skill（后端 ruoyi-admin）。

  触发场景：
  - 新机器首次拉项目，需要装 JDK 21 / Maven、建库导 SQL、配置数据源与 Redis，并第一次启动后端
  - 后端启动报错：JDK 版本不对、端口 8080 被占用、数据库连不上、Redis 未启动 / 密码错
  - 不确定用 IDEA 启动类还是命令行 java -jar / mvnw 哪种方式启动
  - 启动后需要验证健康检查端点与接口文档（避免捏造不存在的 URL）
  - 需要按需启动外置服务端（监控中心 monitor-admin / 任务调度 snailjob-server / AI 服务 snailai-server）

  触发词：本地启动、首次启动、跑起来、装环境、装依赖、安装依赖、配置环境、启动后端、启动项目、JDK21、JDK安装、Maven、Maven安装、mvn、mvnw、MySQL、Redis、端口占用、健康检查、健康端点、profile、启动类、actuator、SpringDoc、数据库连不上、Redis未启动
---

# 本地启动与环境搭建（后端 ruoyi-admin）

> 适用范围：本项目后端（包名 `org.dromara`，Web 入口模块 `ruoyi-admin`，启动类 `org.dromara.DromaraApplication`）。
> 本 Skill 只讲**后端**本地启动与环境搭建。前端 `plus-ui` 在仓库内 `plus-ui/` 目录，单独装依赖与启动，本文不展开。

## 一、概述

本框架是基于 Spring Boot 4.1 + Java 21 的分布式后台管理系统，Web 容器采用 **Jetty**（非 Tomcat），ORM 用 MyBatis-Plus，认证用 Sa-Token，缓存用 Redis（Redisson 客户端）。

首次在新机器跑起来，本质是 5 步：

1. 装运行时：**JDK 21**（强制，SB4 要求）+ Maven 3.8+（或直接用项目自带 `mvnw`）。
2. 装中间件：**MySQL** + **Redis**（两者均为必需，缺一启动即失败）。
3. 建库导 SQL：建数据库 `ry-vue` → 导入 `scripts/sql/ry_vue.sql`（按需再导 `ry_job.sql` / `ry_ai.sql` / `ry_workflow.sql`）。
4. 改配置：编辑 `ruoyi-admin/src/main/resources/application-dev.yml` 的数据源 URL / 账号密码、Redis 地址 / 密码。
5. 编译启动：`mvn -DskipTests clean package` 后用 IDEA 启动类或 `java -jar` 启动，访问健康端点验证。

> ⚠️ 端口、数据库名、Redis 密码等**一切以源码 yml 实际值为准**。本文给出的值取自 `ruoyi-admin/src/main/resources/application.yml` 与 `application-dev.yml`（dev 为默认激活 profile）；若你本地改过这些文件，以你改后的实际值为准。

## 二、环境要求

| 组件 | 版本 / 要求 | 来源 / 说明 |
|------|-------------|-------------|
| **JDK** | **21（必须）** | `pom.xml` `<java.version>21</java.version>`，Spring Boot 4.1 强制 JDK 21+（README 标注同时兼容 JDK 25） |
| **Maven** | 3.8+，或用项目自带 `mvnw` / `mvnw.cmd` | 根目录提供 Maven Wrapper，无需本机预装 Maven |
| **MySQL** | 5.7+ / 8.x（默认数据源 MySQL，驱动 `com.mysql.cj.jdbc.Driver`） | `application-dev.yml` 默认 `jdbc:mysql://localhost:3306/ry-vue`。也原生支持 Oracle / PostgreSQL / SQLServer（见 `scripts/sql/oracle|postgres|sqlserver` 目录），但需自行打开 yml 中对应注释数据源 |
| **Redis** | 6+（**必需**，密码必须配置） | `application-dev.yml` `spring.data.redis`：`localhost:6379` / `database:0` / `password: ruoyi123`。Redisson 单机配置 |
| Web 容器 | Jetty（已内置，无需单独装） | README 明确采用 Jetty，启动日志会显示 Jetty 而非 Tomcat |
| IDE | IntelliJ IDEA（推荐，需启用 Lombok / MapStruct 注解处理器） | 编译期依赖 Lombok + Mapstruct-Plus + therapi-javadoc 注解处理器（见 `pom.xml` `annotationProcessorPaths`） |
| 操作系统 | Windows / macOS / Linux 均可 | 本机为 Windows，命令示例以 PowerShell / cmd 为主 |

> Maven 仓库：`pom.xml` 已配置华为云镜像（`https://mirrors.huaweicloud.com/repository/maven/`），国内下载依赖较快，一般无需再改 `settings.xml`。

## 三、首次环境搭建步骤

### 1. 安装 JDK 21 并校验

```bash
# 校验当前 JDK 版本，必须是 21（或更高的 21+，如 25）
java -version
# 期望输出包含： openjdk version "21" ... 或 "21.0.x"
```

若不是 21：到 Adoptium / Oracle 下载 JDK 21，安装后设置 `JAVA_HOME` 指向 JDK 21 目录，并把 `%JAVA_HOME%\bin` 加到 `PATH`。IDEA 中还需在 `File → Project Structure → Project SDK` 选 JDK 21，`Settings → Build → Compiler → Java Compiler` 的 target 设为 21。

### 2. 准备数据库（MySQL）

```sql
-- 1) 创建数据库（字符集 utf8mb4，与连接串 characterEncoding=utf8 兼容）
CREATE DATABASE `ry-vue` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

然后导入建表脚本（脚本位于 `scripts/sql/`）：

| SQL 脚本 | 是否必需 | 说明 |
|----------|---------|------|
| `ry_vue.sql` | **必导** | 系统主库：用户、菜单、字典、文件、日志等核心表 |
| `ry_job.sql` | 按需 | SnailJob 任务调度相关表（启用调度中心时导入） |
| `ry_ai.sql` | 按需 | AI 业务模块相关表（启用 AI 功能时导入） |
| `ry_workflow.sql` | 按需 | WarmFlow 工作流相关表（启用工作流时导入） |

```bash
# 命令行导入主库脚本（按机器实际 mysql 客户端路径调整）
mysql -uroot -proot ry-vue < scripts/sql/ry_vue.sql
# 按需再导入其它脚本
mysql -uroot -proot ry-vue < scripts/sql/ry_job.sql
```

> Oracle / PostgreSQL / SQLServer 用户：改用 `scripts/sql/oracle/` `scripts/sql/postgres/` `scripts/sql/sqlserver/` 下的对应脚本，并在 yml 中打开对应数据源注释（同时关闭 / 调整 master 的 MySQL 配置）。

### 3. 修改 dev 环境配置（数据源 + Redis）

编辑 `ruoyi-admin/src/main/resources/application-dev.yml`，按本地实际改这两处：

```yaml
# 数据源（master）
spring:
  datasource:
    dynamic:
      datasource:
        master:
          url: jdbc:mysql://localhost:3306/ry-vue?useUnicode=true&characterEncoding=utf8&...  # 库名/地址按需改
          username: root      # 改成你的 MySQL 账号
          password: root      # 改成你的 MySQL 密码

# Redis（单机）
spring.data:
  redis:
    host: localhost
    port: 6379
    database: 0
    password: ruoyi123        # 改成你的 Redis 密码（框架要求 Redis 必须配置密码）
```

> 注意：`spring.profiles.active` 由 Maven 过滤变量 `@profiles.active@` 注入（见 `application.yml`），默认激活 **dev**（`pom.xml` 中 dev profile `activeByDefault=true`）。所以默认读取的就是 `application-dev.yml`。还有 `local`、`prod` 两个 profile 可切换。

### 4. 确认 Redis 已配置密码并启动

框架要求 Redis 必须有密码（yml 注释明确写"redis 密码必须配置"）。本地 Redis 若没设密码，要么给 Redis 配上密码，要么把 yml 的 password 改成你的真实密码——但不能留空。

```bash
# 验证 Redis 可连通（用 yml 里配的密码）
redis-cli -h localhost -p 6379 -a ruoyi123 ping
# 期望输出： PONG
```

## 四、编译与启动

### 1. 编译打包

```bash
# 用本机 Maven（推荐先跳过测试快速验证可编译）
mvn -DskipTests clean package

# 或用项目自带 Maven Wrapper（无需本机装 Maven）
# Windows:
mvnw.cmd -DskipTests clean package
# macOS / Linux:
./mvnw -DskipTests clean package
```

> 说明：`pom.xml` 中 `maven.test.skip=true` 默认就跳过测试，`-DskipTests` 是双保险。首次编译会下载大量依赖（走华为云镜像），耐心等待。

### 2. 启动方式一：IDEA 启动类（开发首选）

直接运行启动类 `org.dromara.DromaraApplication`（位于 `ruoyi-admin/src/main/java/org/dromara/DromaraApplication.java`）的 `main` 方法。

- 启动成功控制台会打印 `ruoyi-admin` 的 banner 横幅
- IDEA 务必启用 Lombok 插件与注解处理（Enable annotation processing），否则编译期 `@Data` 生成的 get/set 与 Mapstruct 转换类会缺失，报一堆"找不到方法 / 符号"。

### 3. 启动方式二：命令行 java -jar（部署 / 无 IDE 环境）

打包后产物在 `ruoyi-admin/target/` 下（jar 名形如 `ruoyi-admin.jar`，版本随 `pom.xml` 的 `revision` 变化）：

```bash
# 用 dev profile 启动（库/Redis 等读 application-dev.yml）
java -jar ruoyi-admin/target/ruoyi-admin.jar --spring.profiles.active=dev

# 指定 JVM 启动内存（生产示例）
java -Xms512m -Xmx1024m -jar ruoyi-admin/target/ruoyi-admin.jar --spring.profiles.active=prod
```

> 通配写法 `java -jar ruoyi-admin/target/*.jar --spring.profiles.active=dev` 在部分 shell 中通配符不展开会失败，建议先 `ls ruoyi-admin/target/*.jar` 看准确文件名再写全名。

## 五、外置服务端（按需启动）

下列三个服务在 `ruoyi-extend/` 下，是**独立可执行的 Server**，默认主应用里对应的 **client 开关是关闭的**，不启动它们不影响主应用跑起来。只有当你要用监控 / 分布式调度 / AI 功能时，才需要先起对应 Server，再在主应用 yml 打开对应 client 开关。

| 外置服务 | 模块路径 | 默认端口 / 说明 | 配套主应用开关 |
|----------|---------|-----------------|----------------|
| 监控中心 | `ruoyi-extend/ruoyi-monitor-admin` | `9090`，context-path `/admin`（Spring Boot Admin 服务端） | `application-dev.yml` 的 `spring.boot.admin.client.enabled`，默认 `false` |
| 任务调度 | `ruoyi-extend/ruoyi-snailjob-server` | 见该模块自身配置；主应用客户端默认 `snail-job.enabled: false` | `application-dev.yml` 的 `snail-job.enabled`，默认 `false`（server.port 默认 17888，客户端口随主端口漂移 `2${server.port}`） |
| AI 服务 | `ruoyi-extend/ruoyi-snailai-server` | gRPC `18888` 等；主应用客户端默认 `snail-ai.enabled: false` | `application-dev.yml` 的 `snail-ai.enabled`，默认 `false` |

启动方式与主应用一致：用各自模块的启动类（IDEA）或单独打包后 `java -jar`。

> 健康端点 `actuator` 在主应用中通过 `management.endpoints.web.exposure.include: '*'` 全量暴露，且 `health.show-details: ALWAYS`。

## 六、健康验证

启动成功后，用下面方式确认服务真的起来了（**端口以 `application.yml` 的 `server.port` 为准**，下方按当前源码值 `8080`、context-path `/` 给出；若你改过 `server.port` 或 context-path，请相应替换，不确定就先打开 `application.yml` 确认或让用户确认实际端口）：

| 验证项 | 地址（默认 8080） | 来源 |
|--------|-------------------|------|
| Actuator 健康端点 | `http://localhost:8080/actuator/health` | `management.endpoints.web.exposure.include: '*'`，health `show-details: ALWAYS` |
| 全部 Actuator 端点 | `http://localhost:8080/actuator` | 同上（全量暴露） |
| SpringDoc 接口文档（OpenAPI） | `http://localhost:8080/v3/api-docs` | `springdoc.api-docs.enabled: true`（含分组：演示 / 通用 / 系统 / 代码生成 / 工作流） |

```bash
# 命令行验证健康端点（期望返回 JSON，status 字段为 UP）
curl http://localhost:8080/actuator/health
```

> ⚠️ 不要凭印象捏造 `/health`、`/swagger-ui.html` 之类路径就当成结论。本框架 actuator 默认前缀是 `/actuator`；接口文档的具体 UI 路径以 SpringDoc 实际渲染为准，拿不准时打开 `application.yml` 的 `springdoc` 段确认，或直接让用户在浏览器试一下再下结论。

## 七、常见坑与排查

1. **JDK 版本不对** —— 最高频。报 `class file has wrong version 65.0` / `Unsupported class file major version` / 启动直接 `UnsupportedClassVersionError`，根因是用了 JDK 17 或更低。先 `java -version` 确认是 21，IDEA 里再确认 Project SDK 与 Java Compiler target 都是 21。
2. **端口 8080 被占用** —— 报 `Port 8080 was already in use` / `Address already in use`。按下文"端口占用排查"用 PID 精准处理，**严禁按进程名批量杀**（会误杀宿主 shell / IDE）。
3. **数据库连不上** —— 报 `Communications link failure` / `Access denied for user` / `Unknown database 'ry-vue'`。依次查：MySQL 是否启动、库 `ry-vue` 是否建好并导入了 `ry_vue.sql`、`application-dev.yml` 的 url / username / password 是否正确。
4. **Redis 未启动 / 密码错** —— 报 `Unable to connect to Redis` / `NOAUTH Authentication required` / `WRONGPASS`。本框架 Redis 是必需项且要求配置密码：确认 Redis 进程在跑，且 yml 的 `spring.data.redis.password` 与 Redis 实际密码一致。
5. **Lombok / Mapstruct 注解未生效** —— 报大量"找不到 getXxx / Converter"编译错。IDEA 装 Lombok 插件并勾选 Enable annotation processing；命令行用 `mvn clean package` 走完整注解处理流程。
6. **profile 没切对** —— 读到了非预期的库 / Redis。确认启动参数 `--spring.profiles.active=dev`（或 local/prod），默认是 dev。

### 端口占用排查（按 PID 精准处理，勿按名杀宿主）

```bash
# Windows：查占用 8080 的进程 PID
netstat -ano | findstr :8080
# 拿到 PID 后精准结束（把 <PID> 换成上一步查到的数字）
taskkill /F /PID <PID>
```

> 🔴 严禁 `taskkill /IM java.exe` / `Stop-Process -Name java` 这类按名批杀——会连带杀掉 IDEA、其它 Java 进程乃至当前终端宿主。永远先 `netstat -ano | findstr :端口` 定位 PID，再按 PID 击杀。

## 八、代码示例（命令速查）

```bash
# 1) 校验 JDK 版本（必须 21）
java -version

# 2) 创建数据库并导入主库脚本
mysql -uroot -proot -e "CREATE DATABASE \`ry-vue\` DEFAULT CHARACTER SET utf8mb4;"
mysql -uroot -proot ry-vue < scripts/sql/ry_vue.sql

# 3) 编译打包（跳过测试）
mvn -DskipTests clean package

# 4) 命令行启动（dev profile）
java -jar ruoyi-admin/target/ruoyi-admin.jar --spring.profiles.active=dev

# 5) 验证健康端点（期望 status=UP）
curl http://localhost:8080/actuator/health

# 6) 验证 Redis 连通（用 yml 配置的密码）
redis-cli -h localhost -p 6379 -a ruoyi123 ping
```

## 九、常见错误对比

| 错误现象 | 错误做法 ❌ | 正确做法 ✅ |
|----------|-----------|-----------|
| 启动报 `Unsupported class file major version` | 直接降级框架版本 / 删依赖瞎试 | 升级到 **JDK 21** 并在 IDEA Project SDK + Java Compiler 同步改为 21 |
| 8080 端口被占用 | `taskkill /IM java.exe` 按名批杀（会误杀 IDE / 终端宿主） | `netstat -ano \| findstr :8080` 定位 PID → `taskkill /F /PID <PID>` 精准击杀 |
| Redis 报 `NOAUTH` / 连接失败 | 把 yml 的 `password` 删掉留空当作"无密码" | 给 Redis 配密码或把 yml 的 `password` 改成真实密码（框架要求 Redis 必须有密码） |
| 启动找不到 `getXxx` 方法 | 手动给实体类补 get/set | IDEA 启用 Lombok 插件 + Enable annotation processing；命令行用 `mvn clean package` |
| 数据库报 `Unknown database 'ry-vue'` | 改连接串连到其它库凑合 | 按 yml 实际库名建库并导入 `scripts/sql/ry_vue.sql` |

## 十、最佳实践

1. **先验证再启动**：起后端前先把 MySQL、Redis 各连一次（`mysql -e "select 1"`、`redis-cli ping`），把中间件问题挡在启动前，比看一长串启动栈快得多。
2. **dev 用启动类、部署用 jar**：本地开发优先 IDEA 启动类（热重载、断点方便）；服务器 / CI 用 `java -jar ... --spring.profiles.active=prod`，profile 用启动参数显式指定，别依赖默认值。
3. **外置 Server 按需起**：监控 / 调度 / AI 三个 Server 默认 client 关闭，不用就别起，能减少本地端口与内存占用；要用时先起 Server 再开主应用对应 client 开关。
4. **改配置走 dev 文件，不动 application.yml 主配置**：数据源 / Redis 等环境相关的值改在 `application-dev.yml`（或对应 profile 文件），`application.yml` 里多为带 `@xxx@` 占位的公共配置，乱改会影响所有环境。
5. **端口处理永远按 PID**：任何"端口占用"问题都用 `netstat -ano | findstr :端口` 找 PID 再精准 `taskkill /F /PID`，绝不按进程名批杀，避免误伤宿主进程。
6. **健康端点不要猜**：验证服务用源码里确实暴露的 `/actuator/health` 与 `/v3/api-docs`，不确定的 UI 路径打开 yml 的 `springdoc` 段确认或让用户实测，不凭记忆编造 URL。
