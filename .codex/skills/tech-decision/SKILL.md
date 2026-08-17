---
name: tech-decision
description: |
  当需要进行技术选型、对比方案时自动使用此 Skill。

  触发场景：
  - 选择用什么技术/库
  - 对比不同方案
  - 技术决策
  - 评估优缺点
  - 选择 ruoyi-common 模块

  触发词：选型、用什么、对比、哪个好、优缺点、选择、技术方案、库、框架、工具、模块
---

# 技术决策指南

## 本项目技术栈（精确版本）

### 后端核心技术

| 技术 | 版本 | 用途 | 模块位置 |
|------|------|------|---------|
| **Spring Boot** | 3.5.8 | 基础框架 | 全局 |
| **Java** | 21 | 开发语言 | 全局 |
| **MyBatis-Plus** | 3.5.14 | ORM 框架 | ruoyi-common-mybatis |
| **Sa-Token** | 1.44.0 | 权限认证 | ruoyi-common-satoken |
| **Hutool** | 5.8.40 | 工具库 | ruoyi-common-core |
| **Redisson** | 3.52.0 | Redis 客户端增强 | ruoyi-common-redis |
| **MapStruct-Plus** | 1.5.0 | 对象映射 | 全局 |
| **SpringDoc** | 2.8.14 | API 文档 | ruoyi-common-doc |
| **Lombok** | 1.18.36 | 代码简化 | 全局 |
| **FastExcel** | 1.3.0 | Excel 处理 | ruoyi-common-excel |

### 后端扩展技术

| 技术 | 版本 | 用途 | 模块位置 |
|------|------|------|---------|
| **Lock4j** | 2.2.7 | 分布式锁 | ruoyi-common-redis |
| **SnailJob** | 1.8.0 | 分布式任务调度 | ruoyi-common-job |
| **RocketMQ** | 5.3.1 | 消息队列 | ruoyi-common-rocketmq |
| **Mica-MQTT** | 2.5.7 | MQTT 通信 | ruoyi-common-mqtt |
| **LangChain4j** | 0.35.0 | AI 大模型集成 | ruoyi-common-langchain4j |
| **Forest** | 1.7.1 | HTTP 客户端 | ruoyi-common-http |
| **AWS SDK** | 2.28.22 | 对象存储 | ruoyi-common-oss |
| **SMS4j** | 3.3.5 | 短信服务 | ruoyi-common-sms |
| **JustAuth** | 1.16.7 | 第三方登录 | ruoyi-common-social |
| **IP2Region** | 2.7.0 | IP 地址定位 | ruoyi-common-core |
| **P6spy** | 3.9.1 | SQL 日志 | 开发环境 |

### 微信生态与支付

| 技术 | 版本 | 用途 | 模块位置 |
|------|------|------|---------|
| **WxJava** | 4.7.6.B | 微信全家桶 | ruoyi-common-miniapp/mp |
| **Alipay SDK** | 4.38.61 | 支付宝支付 | ruoyi-common-pay-alipay |

### 前端技术 (plus-ui)

| 技术 | 版本 | 用途 |
|------|------|------|
| **Vue** | 3.5.13 | 前端框架 |
| **Element Plus** | 2.9.8 | UI 组件库 |
| **TypeScript** | 5.8.3 | 类型支持 |
| **Vite** | 6.3.2 | 构建工具 |
| **Pinia** | 3.0.2 | 状态管理 |
| **Vue Router** | 4.5.0 | 路由管理 |
| **Axios** | 1.8.4 | HTTP 请求 |
| **Echarts** | 5.6.0 | 图表库 |
| **VueUse** | 13.1.0 | 组合式工具 |
| **WangEditor** | 5.1.23 | 富文本编辑器 |
| **Sass** | 1.87.0 | CSS 预处理器 |

### 移动端技术 (plus-uniapp)

| 技术 | 版本 | 用途 |
|------|------|------|
| **UniApp** | 3.0.0-4060620250520001 | 跨端框架 |
| **Vue** | 3.4.21 | 前端框架 |
| **Pinia** | 2.0.36 | 状态管理 |
| **WD UI (Wot Design)** | - | UI 组件库 |
| **UnoCSS** | 65.4.2 | 原子化 CSS |

---

## ruoyi-common 模块速查（35个模块）

### 🔴 高频使用模块（几乎每个项目都用）

| 模块 | 说明 | 典型场景 |
|------|------|---------|
| `ruoyi-common-core` | 核心工具类 | StringUtils、MapstructUtils、异常处理 |
| `ruoyi-common-mybatis` | MyBatis 增强 | Mapper 基类(BaseMapperPlus)、分页、查询构建器 |
| `ruoyi-common-redis` | Redis 缓存 | 缓存、分布式锁、延迟队列 |
| `ruoyi-common-satoken` | 权限认证 | 登录、权限控制、Token 管理 |
| `ruoyi-common-web` | Web 基础 | 拦截器、过滤器、跨域 |
| `ruoyi-common-json` | JSON 序列化 | Jackson 配置、Long 精度处理 |
| `ruoyi-common-log` | 日志记录 | 操作日志、登录日志 |

### 🟡 按需使用模块（根据业务需求）

#### 数据处理

| 模块 | 说明 | 使用场景 |
|------|------|---------|
| `ruoyi-common-excel` | Excel 导入导出 | 数据导入、报表导出 |
| `ruoyi-common-oss` | 对象存储 | 文件上传（S3/MinIO/阿里云/腾讯云） |
| `ruoyi-common-encrypt` | 数据加密 | 数据库字段加密存储 |
| `ruoyi-common-sensitive` | 数据脱敏 | 手机号、身份证脱敏显示 |
| `ruoyi-common-serialmap` | 序列化映射 | ID→名称、字典→标签自动转换 |

#### 通信与消息

| 模块 | 说明 | 使用场景 |
|------|------|---------|
| `ruoyi-common-websocket` | WebSocket | 实时消息推送、在线聊天 |
| `ruoyi-common-sse` | 服务端推送 | AI 流式响应、单向推送 |
| `ruoyi-common-mail` | 邮件发送 | 通知邮件、验证码 |
| `ruoyi-common-sms` | 短信发送 | 短信验证码、营销短信 |
| `ruoyi-common-message` | 统一消息 | 消息路由、批量发送、降级 |
| `ruoyi-common-http` | HTTP 客户端 | 调用第三方 API |

#### 微信生态

| 模块 | 说明 | 使用场景 |
|------|------|---------|
| `ruoyi-common-miniapp` | 微信小程序 | 小程序登录、用户信息 |
| `ruoyi-common-mp` | 微信公众号 | 公众号消息、菜单、素材 |

#### 支付模块

| 模块 | 说明 | 使用场景 |
|------|------|---------|
| `ruoyi-common-pay` | 支付聚合 | 一次性引入所有支付方式 |
| `ruoyi-common-pay-core` | 支付核心 | 支付抽象层、回调处理 |
| `ruoyi-common-pay-wechat` | 微信支付 | 微信 JSAPI/Native/H5 支付 |
| `ruoyi-common-pay-alipay` | 支付宝支付 | 支付宝 PC/手机支付 |
| `ruoyi-common-pay-balance` | 余额支付 | 账户余额扣款 |
| `ruoyi-common-pay-unionpay` | 银联支付 | 银联在线支付 |

#### 系统功能

| 模块 | 说明 | 使用场景 |
|------|------|---------|
| `ruoyi-common-tenant` | 多租户 | SaaS 多租户隔离 |
| `ruoyi-common-job` | 任务调度 | 定时任务（SnailJob） |
| `ruoyi-common-rocketmq` | 消息队列 | 异步处理、削峰填谷 |
| `ruoyi-common-mqtt` | MQTT 通信 | IoT 设备通信 |
| `ruoyi-common-idempotent` | 幂等控制 | 防重复提交 |
| `ruoyi-common-ratelimiter` | 接口限流 | 防刷、保护接口 |
| `ruoyi-common-social` | 社交登录 | 微信/QQ/微博登录 |

#### AI 与文档

| 模块 | 说明 | 使用场景 |
|------|------|---------|
| `ruoyi-common-langchain4j` | AI 集成 | ChatGPT/DeepSeek 对话 |
| `ruoyi-common-doc` | API 文档 | Swagger/OpenAPI 文档 |
| `ruoyi-common-openapi` | OpenAPI | 开放接口认证 |
| `ruoyi-common-media` | 多媒体处理 | 图片、海报、GIF 生成 |

#### 安全与测试

| 模块 | 说明 | 使用场景 |
|------|------|---------|
| `ruoyi-common-security` | 应用安全 | XSS 防护、SQL 注入防护 |
| `ruoyi-common-test` | 测试支持 | 单元测试、集成测试 |

---

## 技术选型决策树

### 场景 1：需要实时通信？

```
需要实时双向通信？
├─ 是 → WebSocket（ruoyi-common-websocket）
│      适用：在线聊天、协同编辑、实时游戏
│
└─ 否 → 需要服务端主动推送？
         ├─ 是 → SSE（ruoyi-common-sse）
         │      适用：AI 流式响应、通知推送、进度更新
         │
         └─ 否 → 需要物联网通信？
                ├─ 是 → MQTT（ruoyi-common-mqtt）
                │      适用：设备上报、指令下发、低功耗场景
                │
                └─ 否 → HTTP 轮询或普通请求
```

### 场景 2：需要异步处理/消息队列？

```
需要异步处理？
├─ 简单异步（同一应用内）
│   └─ @Async + Spring TaskExecutor
│      适用：发送邮件、记录日志等不需要可靠性保证的任务
│
├─ 需要延迟执行？
│   └─ Redis 延迟队列（RedissonDelayedQueue）
│      适用：订单超时取消、延迟通知（ruoyi-common-redis）
│
├─ 需要高可靠/高吞吐？
│   └─ RocketMQ（ruoyi-common-rocketmq）
│      适用：订单处理、库存扣减、分布式事务
│
└─ 不需要异步 → 同步调用
```

### 场景 3：需要定时任务？

```
需要定时任务？
├─ 单机简单任务（不需要分布式）
│   └─ @Scheduled（Spring 原生）
│      适用：清理临时文件、统计数据、心跳检测
│
├─ 分布式调度/复杂任务
│   └─ SnailJob（ruoyi-common-job）
│      适用：多节点任务、失败重试、任务编排、可视化管理
│
└─ 延迟任务（非周期性）
    └─ Redis 延迟队列
       适用：订单超时取消、定时发布
```

### 场景 4：需要缓存？

```
需要缓存？
├─ 简单 Key-Value 缓存
│   └─ Redis String（ruoyi-common-redis）
│      适用：用户信息、配置数据、Token
│
├─ 分布式锁
│   └─ Lock4j + Redisson（ruoyi-common-redis）
│      适用：库存扣减、防重复操作
│
├─ 排行榜/计数器
│   └─ Redis ZSet/Hash
│      适用：热门排行、点赞计数、在线人数
│
├─ 布隆过滤器（防缓存穿透）
│   └─ Redisson BloomFilter
│      适用：用户存在性检查、黑名单过滤
│
└─ 本地缓存（高频访问）
    └─ Caffeine
       适用：字典数据、菜单数据（本项目已集成）
```

### 场景 5：需要支付？

```
需要支付功能？
├─ 只需要微信支付
│   └─ ruoyi-common-pay-wechat
│
├─ 只需要支付宝支付
│   └─ ruoyi-common-pay-alipay
│
├─ 需要多种支付方式
│   └─ ruoyi-common-pay（聚合模块）
│      包含：微信、支付宝、余额、银联
│
└─ 需要自定义支付
    └─ 继承 ruoyi-common-pay-core
       实现自定义支付渠道
```

### 场景 6：需要第三方登录？

```
需要第三方登录？
├─ 只需要微信登录（小程序/公众号）
│   └─ ruoyi-common-miniapp / ruoyi-common-mp
│      使用 WxJava 原生 API
│
├─ 需要多平台登录（微信/QQ/微博/GitHub等）
│   └─ ruoyi-common-social（基于 JustAuth）
│      支持 20+ 平台
│
└─ 企业微信/钉钉登录
    └─ ruoyi-common-social（已内置支持）
```

---

## 技术优先级指南

### 优先级 1：首选方案（覆盖 80% 场景）

| 需求 | 首选技术 | 模块 | 理由 |
|------|---------|------|------|
| 缓存 | Redis | ruoyi-common-redis | 功能全面、生态成熟 |
| 分布式锁 | Lock4j | ruoyi-common-redis | 注解简单、自动续期 |
| 实时通信 | WebSocket | ruoyi-common-websocket | 双向通信、广泛支持 |
| 定时任务（简单） | @Scheduled | Spring 原生 | 零配置、够用 |
| 文件上传 | OSS | ruoyi-common-oss | 统一接口、多云支持 |
| 权限认证 | Sa-Token | ruoyi-common-satoken | 功能强大、文档好 |
| 对象转换 | MapStruct | 全局 | 编译期生成、性能好 |

### 优先级 2：进阶方案（特定场景）

| 需求 | 进阶技术 | 模块 | 使用条件 |
|------|---------|------|---------|
| 消息队列 | RocketMQ | ruoyi-common-rocketmq | 高并发、事务消息 |
| 定时任务（复杂） | SnailJob | ruoyi-common-job | 分布式、可视化 |
| AI 对话 | LangChain4j | ruoyi-common-langchain4j | AI 业务需求 |
| IoT 通信 | MQTT | ruoyi-common-mqtt | 物联网场景 |
| 流式推送 | SSE | ruoyi-common-sse | AI 流式响应 |

### 优先级 3：专用方案（特殊需求）

| 需求 | 专用技术 | 模块 | 备注 |
|------|---------|------|------|
| 微信支付 | WxJava | ruoyi-common-pay-wechat | 微信生态专用 |
| 支付宝支付 | Alipay SDK | ruoyi-common-pay-alipay | 阿里生态专用 |
| 短信发送 | SMS4j | ruoyi-common-sms | 多平台聚合 |
| 第三方登录 | JustAuth | ruoyi-common-social | 20+ 平台支持 |

---

## 常见选型对比

### 1. 消息队列选型

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **Redis Streams** | 轻量消息、简单队列 | 无额外依赖、使用简单 | 功能有限、无事务 |
| **RocketMQ** | 高并发、事务消息 | 高吞吐、延迟消息、事务 | 需要额外部署 |
| **RabbitMQ** | 复杂路由、协议支持 | 路由灵活、AMQP 标准 | 本项目未集成 |
| **Kafka** | 大数据、日志收集 | 超高吞吐、持久化 | 本项目未集成 |

**本项目推荐**：
- 简单场景 → Redis Streams（ruoyi-common-redis）
- 复杂场景 → RocketMQ（ruoyi-common-rocketmq）

### 2. 定时任务选型

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **@Scheduled** | 单机简单任务 | 零配置、Spring 原生 | 无分布式支持 |
| **SnailJob** | 分布式复杂任务 | 可视化、失败重试、工作流 | 需要额外部署 |
| **XXL-Job** | 分布式任务 | 文档丰富、社区活跃 | 本项目未集成 |
| **Quartz** | 传统定时任务 | 功能完善、历史悠久 | 配置复杂 |

**本项目推荐**：
- 简单场景 → @Scheduled
- 复杂场景 → SnailJob（ruoyi-common-job）

### 3. HTTP 客户端选型

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **RestTemplate** | 简单 HTTP 调用 | Spring 原生、简单 | 同步阻塞、功能有限 |
| **WebClient** | 响应式 HTTP | 异步非阻塞 | 学习曲线 |
| **Forest** | 声明式 HTTP | 注解驱动、类似 Feign | 额外依赖 |
| **OkHttp** | 高性能 HTTP | 连接池、拦截器 | 需要手动封装 |

**本项目推荐**：
- 简单场景 → RestTemplate
- 声明式调用 → Forest（ruoyi-common-http）

### 4. Excel 处理选型

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **FastExcel** | 大文件、高性能 | 内存占用低、速度快 | 功能相对简单 |
| **EasyExcel** | 通用场景 | 功能全面、文档好 | 阿里维护 |
| **Apache POI** | 复杂操作 | 功能最全 | 内存占用大 |

**本项目推荐**：FastExcel（ruoyi-common-excel）

### 5. 状态管理选型（前端）

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **Pinia** | Vue 3 项目 | 轻量、TS 支持好、官方推荐 | Vue 3 专属 |
| **Vuex** | Vue 2 项目 | 成熟、生态完善 | 模板代码多 |
| **组件内 ref** | 简单页面 | 简单直接 | 跨组件困难 |

**本项目选择**：Pinia 3.0.2

---

## 决策记录模板

```markdown
# [决策标题]

## 背景
[为什么需要做这个决策]

## 决策内容
[选择了什么，如何实现]

## 考虑的方案
| 方案 | 优点 | 缺点 | 评分 |
|------|------|------|------|
| 方案A | | | |
| 方案B | | | |
| 方案C | | | |

## 决策理由
1. [理由1]
2. [理由2]
3. [理由3]

## 后果
- **优点**：[带来的好处]
- **缺点**：[需要接受的代价]
- **风险**：[潜在风险及应对]

## 日期
[YYYY-MM-DD]
```

---

## 模块引入示例

### 在 pom.xml 中引入模块

```xml
<!-- 按需引入 ruoyi-common 模块 -->
<dependencies>
    <!-- 核心模块（必须） -->
    <dependency>
        <groupId>org.dromara</groupId>
        <artifactId>ruoyi-common-core</artifactId>
    </dependency>

    <!-- MyBatis（必须） -->
    <dependency>
        <groupId>org.dromara</groupId>
        <artifactId>ruoyi-common-mybatis</artifactId>
    </dependency>

    <!-- Redis 缓存（推荐） -->
    <dependency>
        <groupId>org.dromara</groupId>
        <artifactId>ruoyi-common-redis</artifactId>
    </dependency>

    <!-- 微信小程序（按需） -->
    <dependency>
        <groupId>org.dromara</groupId>
        <artifactId>ruoyi-common-miniapp</artifactId>
    </dependency>

    <!-- 支付聚合（按需） -->
    <dependency>
        <groupId>org.dromara</groupId>
        <artifactId>ruoyi-common-pay</artifactId>
    </dependency>
</dependencies>
```

### 支付模块引入方式

```xml
<!-- 方式1：引入所有支付方式 -->
<dependency>
    <groupId>org.dromara</groupId>
    <artifactId>ruoyi-common-pay</artifactId>
</dependency>

<!-- 方式2：只引入需要的支付方式 -->
<dependency>
    <groupId>org.dromara</groupId>
    <artifactId>ruoyi-common-pay-core</artifactId>
</dependency>
<dependency>
    <groupId>org.dromara</groupId>
    <artifactId>ruoyi-common-pay-wechat</artifactId>
</dependency>
```

---

## 评估检查清单

### 选型前必查

- [ ] **功能满足**：是否满足当前功能需求？
- [ ] **性能满足**：是否满足性能要求？
- [ ] **社区活跃**：GitHub Stars、Issues 响应速度？
- [ ] **文档完善**：是否有中文文档？
- [ ] **兼容性**：与现有技术栈是否兼容？
- [ ] **学习成本**：团队是否熟悉？学习曲线如何？
- [ ] **维护成本**：长期维护成本如何？
- [ ] **安全漏洞**：是否有已知安全漏洞？
- [ ] **License**：是否允许商用？
- [ ] **项目已有**：ruoyi-common 是否已经集成？

### 本项目优先原则

1. **优先使用 ruoyi-common 模块**：已集成、已测试、风格统一
2. **优先使用 Hutool 工具类**：项目已依赖，无需额外引入
3. **优先使用 Spring 原生**：稳定、文档全、社区大
4. **避免重复造轮子**：先查 ruoyi-common 是否有现成实现

---

## 快速决策参考

| 我想要... | 用这个 | 模块/技术 |
|----------|--------|---------|
| 缓存数据 | Redis | ruoyi-common-redis |
| 分布式锁 | Lock4j | ruoyi-common-redis |
| 发送短信 | SMS4j | ruoyi-common-sms |
| 发送邮件 | Spring Mail | ruoyi-common-mail |
| 上传文件 | AWS S3 SDK | ruoyi-common-oss |
| 微信登录 | WxJava | ruoyi-common-miniapp |
| 微信支付 | WxJava | ruoyi-common-pay-wechat |
| 支付宝支付 | Alipay SDK | ruoyi-common-pay-alipay |
| 定时任务（简单） | @Scheduled | Spring 原生 |
| 定时任务（复杂） | SnailJob | ruoyi-common-job |
| 消息队列 | RocketMQ | ruoyi-common-rocketmq |
| 实时推送 | WebSocket | ruoyi-common-websocket |
| 流式响应 | SSE | ruoyi-common-sse |
| AI 对话 | LangChain4j | ruoyi-common-langchain4j |
| IoT 通信 | MQTT | ruoyi-common-mqtt |
| 数据脱敏 | @Sensitive | ruoyi-common-sensitive |
| 字段加密 | @EncryptField | ruoyi-common-encrypt |
| ID→名称映射 | @SerialMap | ruoyi-common-serialmap |
| 接口限流 | @RateLimiter | ruoyi-common-ratelimiter |
| 防重复提交 | @RepeatSubmit | ruoyi-common-idempotent |
| 第三方登录 | JustAuth | ruoyi-common-social |
| Excel 导出 | FastExcel | ruoyi-common-excel |
| API 文档 | SpringDoc | ruoyi-common-doc |
| HTTP 调用 | Forest | ruoyi-common-http |

---

## 🔗 关联技能边界

本技能专注于**具体技术方案二选一/多选一**。遇到以下场景请改用其他技能：

| 场景 | 应使用技能 | 判断关键词 |
|------|-----------|-----------|
| 系统架构、模块划分、分层设计 | `architecture-design` | "怎么分模块"、"四层架构"、"领域边界" |
| 完全开放式方案探索 | `brainstorm` | "有什么办法"、"头脑风暴" |
| 已知用某技术、要看具体规范 | 对应业务技能 | `redis-cache`、`message-queue` 等 |

**三阶段辨别**：
1. **brainstorm** = 还没收敛方向
2. **architecture-design** = 方向收敛、设计整体架构
3. **tech-decision** = 架构已定、比较具体技术（如 RocketMQ vs Redis Stream）
