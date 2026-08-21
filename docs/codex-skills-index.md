# Codex 技能清单（48 个，含触发词）

> 本文档为根 `AGENTS.md` 第二部分「Codex 技能系统」的完整技能索引。Codex 启动时自动扫描 `.codex/skills/` 下所有 SKILL.md 的 YAML frontmatter（name + description + 触发场景 + 触发词）作为技能索引装入上下文，**无需手动列目录**；本表仅供文档对照，**技能正文必须按需用 Read 读取对应 SKILL.md**。

> 42 个镜像技能（与 `.claude/skills/` 内容一致）+ 6 个命令技能（`dev` / `crud` / `check` / `progress` / `next` / `start`）。按字母排序：

| 技能名 | 触发词 / 用途 |
|--------|--------------|
| `add-skill` | 添加技能、创建技能、新技能、写技能、技能文档、修改技能、更新技能、技能同步——为框架增加/修改/重命名/删除技能并同步双系统 |
| `api-development` | API设计、接口规范、RESTful、URL设计、接口路径、R\<T\>、统一响应、接口命名、端点设计、前后端联动、export导出——接口设计规范（完整模块开发用 crud-development） |
| `architecture-design` | 架构设计、模块划分、分层、解耦、依赖管理、ruoyi-api、契约层、模块拓扑、重构、领域划分、系统设计——模块拓扑/契约层/三层架构/何时新建模块 |
| `backend-annotations` | 注解、@Translation、翻译、ID转名称、字典转标签、@RateLimiter、@RepeatSubmit、@Sensitive、@DataPermission、@Log、@EncryptField、@Lock4j、@DS、@SaCheckPermission、@AutoMapper、分组校验——后端高级注解总索引（重点 @Translation 序列化映射） |
| `brainstorm` | 头脑风暴、方案、怎么设计、有什么办法、创意、讨论、探索、想法、建议、怎么做、如何实现——方案探索与创意思维 |
| `bug-detective` | Bug、报错、不工作、调试、排查、为什么、出问题、失败、不生效、无效、定位问题——排查已发生的问题、定位 Bug（设计异常机制用 error-handler） |
| `check` | /check、代码检查、规范检查、code review、检查代码——命令技能：框架全栈代码规范检查 |
| `code-patterns` | 规范、禁止、命名、Git提交、代码风格、不能用、不允许、约定、红线、禁令、对照表、写法错了——全栈编码禁令与规范速查（错误 vs 正确对照） |
| `collaborating-with-codex` | Codex、协作、多模型、原型、Diff、算法分析、代码审查、codex协同、codex-plugin-cc、codex插件、review-gate——与 OpenAI Codex CLI 协同开发 |
| `collaborating-with-gemini` | Gemini、协作、多模型、前端原型、UI设计、CSS、样式、gemini协同——与 Google Gemini CLI 协同（前端/UI 原型为主） |
| `crud` | /crud、快速CRUD、代码生成、基于表生成、增删改查——命令技能：基于已有表快速生成 CRUD |
| `crud-development` | CRUD、增删改查、新建模块、业务模块、Entity、BO、VO、Mapper、Service、Controller、selectVoPage、PageQuery、QueryBuilder、MapstructUtils、BaseMapperPlus、xxxApi.ts、代码生成器——CRUD 业务模块全栈开发（后端四件套 + 前端数据通道） |
| `data-desensitize` | 脱敏、数据脱敏、@Sensitive、SensitiveStrategy、敏感数据、PII、掩码、手机号脱敏、身份证脱敏、银行卡脱敏、DesensitizedUtils——序列化期 PII 掩码（DB 仍明文） |
| `data-permission` | 数据权限、@DataPermission、@DataColumn、DataScope、行级权限、数据隔离、部门权限、本人权限、自定义权限、权限过滤、PlusDataPermissionHandler、忽略数据权限——行级数据权限（认证授权用 security-guard） |
| `database-ops` | 数据库、MySQL、SQL、表、字段、索引、字典、建表、DDL、del_flag、雪花ID、dynamic-datasource、多数据源、selectVoPage、QueryBuilder、@DS、sys_dict、sys_menu——数据库操作/建表规范/字典菜单/SQL 日志 |
| `deployment-guide` | 部署、上线、发布、生产环境、Docker、Compose、打包、JAR、Jetty、Nginx、反向代理、密钥、profile、application-prod、外置server、monitor-admin、snailjob、snailai-server——部署与上线（JDK21+SB4+Jetty/Docker/三外置 server） |
| `dev` | /dev、开发新功能、全栈开发、新功能、开发模块、写功能——命令技能：开发新功能（全栈代码生成） |
| `dev-startup` | 本地启动、首次启动、跑起来、装环境、装依赖、配置环境、启动后端、JDK21、Maven、mvnw、MySQL、Redis、端口占用、健康检查、actuator、SpringDoc——本地从零搭建后端环境、首次启动、排查启动失败 |
| `elasticsearch-search` | Elasticsearch、ES、Easy-Es、全文检索、搜索引擎、EsMapper、@IndexName、@IndexField、索引、全文搜索——基于 Easy-Es 的 ORM 风格全文检索 |
| `env-config` | 环境配置、profile、application.yml、application-dev.yml、application-prod.yml、多环境、环境变量、SPRING_PROFILES_ACTIVE、占位符、@profiles.active@、${ENV:default}、密钥外置——多环境配置组织/切换/敏感配置脱密（后端） |
| `error-handler` | 异常处理、ServiceException、try-catch、全局异常、GlobalExceptionHandler、错误码、日志规范、@Slf4j、错误提示、校验异常、R响应——设计异常处理机制（排查 Bug 用 bug-detective） |
| `exp-sediment` | 沉淀经验、经验沉淀、总结会话、记下来、记录经验、/exp、exp review、反哺框架、经验审计、避免再踩坑、以前怎么处理、之前的方案、历史经验、查记录、上次怎么解决——经验沉淀（写入）与消费（读取），与 session-start.cjs 配对成闭环 |
| `file-oss-management` | 文件上传、OSS、对象存储、云存储、MinIO、阿里云OSS、腾讯云COS、七牛、S3、AWS、预签名、presigned、SysOss、OssClient、OssFactory——文件上传下载（AWS SDK v2 S3 统一适配） |
| `git-workflow` | git、提交、commit、分支、合并、push、pull、冲突、回滚、版本、历史——Git 版本控制操作 |
| `html-to-code` | HTML转代码、设计稿转换、原型转代码、HTML转Vue、HTML转React、设计稿转页面、区块转换、组件转换、Element Plus、Ant Design Pro——HTML/原型转 6.x 前端代码（Vue 或 React） |
| `i18n-development` | 国际化、多语言、i18n、翻译、MessageUtils、语言切换、content-language、messages.properties、locale、MessageSource、LocaleResolver、zh_CN、en_US——国际化开发（以后端 MessageUtils 为主） |
| `iot-mqtt` | MQTT、物联网、IoT、设备通信、设备消息、mica-mqtt、publish、subscribe、QoS、Topic、EMQX、Mosquitto、共享订阅、设备上线、遗嘱消息——基于 mica-mqtt 的 IoT 通信开发 |
| `json-serialization` | JSON、序列化、反序列化、JsonUtils、Jackson、日期格式、精度、BigDecimal、Long、大数字、类型转换、TypeReference、JSON校验、JsonValueEnhancer、BigNumberSerializer——JSON 处理（Jackson 3，包名 tools.jackson.*） |
| `log-audit` | 操作日志、登录日志、审计、@Log、sys_oper_log、sys_login_info、BusinessType、LogAspect、OperLogEvent、excludeParamNames、isSaveRequestData、日志脱敏——操作/登录日志与审计追踪 |
| `mcp-integration` | MCP、Model Context Protocol、@McpTool、@McpResource、McpClientTemplate、MCP工具、MCP资源、mcp-server、mcp-client、AI工具、agent工具——基于 Spring AI 2.0.0 的 MCP Server/Client 集成 |
| `multi-tenant` | 多租户、租户隔离、tenant_id、TenantHelper、租户切换、ignore、动态租户、sys_tenant、租户套餐、TenantLineInnerInterceptor、SaaS、租户上下文——多租户 SaaS 数据隔离（租户插件 + tenant_id 自动过滤） |
| `next` | /next、下一步、接下来、接下来做什么——命令技能：下一步建议 |
| `performance-doctor` | 性能优化、慢查询、SQL优化、索引、EXPLAIN、N+1、分页优化、缓存、SqlLogInterceptor、SQL日志、响应慢、深分页、HikariCP——性能诊断与优化（"能跑但慢"，逻辑 Bug 用 bug-detective） |
| `progress` | /progress、进度、进度报告、项目进度——命令技能：项目进度报告 |
| `project-navigator` | 项目结构、文件在哪、目录、模块、代码位置、找、定位、在哪里、参考代码、模块职责、ruoyi-common、ruoyi-modules、ruoyi-api、ruoyi-extend、ruoyi-gen、放哪、新建模块——项目结构导航与代码定位 |
| `realtime-push` | 实时推送、消息推送、SSE、WebSocket、PushHelper、服务端推送、广播、在线消息、EventSource、双传输、message.transport、集群广播、通知推送——统一实时推送（SSE/WebSocket 双传输，业务零改动切换） |
| `redis-cache` | Redis、缓存、Cache、@Cacheable、@CacheEvict、RedisUtils、CacheUtils、分布式锁、RLock、Lock4j、限流、@RateLimiter、发布订阅、缓存穿透/雪崩/击穿、缓存key、Redisson、Fory——Redis 缓存/分布式锁/限流/发布订阅 |
| `scheduled-jobs` | 定时任务、SnailJob、延迟队列、@Scheduled、任务调度、重试机制、工作流编排、分布式任务、@JobExecutor、订单超时、周期任务、分片任务、MapReduce、DAG、QueueUtils——定时任务与分布式调度（SnailJob 2.0.0） |
| `security-guard` | 安全、Sa-Token、@SaCheckPermission、@SaCheckLogin、@SaCheckRole、登录认证、Token、LoginHelper、StpUtil、加密、@EncryptField、@ApiEncrypt、限流、@RateLimiter、防重复、@RepeatSubmit、XSS、权限标识——安全开发规范（认证授权/加解密/接口安全） |
| `snail-ai-integration` | AI、Snail AI、SnailAI、大模型、AI对话、Agent、聊天、ai-integration、snail-ai、OpenAPI、AI集成、智能助手——集成/接入/扩展 Snail AI（com.aizuda 0.0.5）大模型能力 |
| `start` | /start、启动、跑起来、本地启动、启动项目——命令技能：项目快速启动 |
| `task-tracker` | 创建任务、跟踪任务、记录进度、任务跟踪、继续任务、恢复任务、查看任务、归档任务、任务列表、方案讨论、技术调研、记录问题——跨会话开发任务进度跟踪（Markdown 持久化） |
| `tech-decision` | 选型、用什么、对比、哪个好、优缺点、选择、技术方案、库、框架、工具、模块——技术选型与方案对比（含选 ruoyi-common 模块） |
| `test-development` | 测试、单元测试、集成测试、@Test、JUnit5、Mockito、Mock、断言、AssertJ、@SpringBootTest、@Mock、@InjectMocks、MockMvc、测试覆盖率、参数化测试、@WebMvcTest、@Tag——测试开发（无统一测试基类） |
| `ui-pc` | 前端、前端页面、Element Plus、el-table、el-form、el-dialog、Ant Design Pro、ProTable、ModalForm、代码生成器前端、Vue页面、React页面、useDict、列表页、表单页、后台页面——后台管理端前端页面（Vue/React 双栈，按生成器模板风格） |
| `utils-toolkit` | 工具类、日期、时间、DateUtils、字符串、StringUtils、集合、StreamUtils、对象转换、MapstructUtils、树结构、TreeBuildUtils、校验、ValidatorUtils、SpringUtils、RedisUtils、Hutool——后端工具类速查，选对工具避免重复造轮子 |
| `workflow-warmflow` | 工作流、流程、审批、Warm-Flow、WorkflowService、流程引擎、发起流程、办理任务、待办、已办、流程图、审批流、ProcessEvent、workflow——Warm-Flow 国产工作流引擎集成（业务只依赖 ruoyi-api 契约） |
| `writing-plans` | 写计划、制定计划、实施计划、拆解任务、任务拆解、计划层、把方案落地、详细步骤、可执行计划、计划文档、开发计划、实施方案——把方案/需求拆成可直接执行的细颗粒任务台账 |
