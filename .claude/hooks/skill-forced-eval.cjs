#!/usr/bin/env node
/**
 * UserPromptSubmit Hook - 强制技能评估 (base-dev-framework6-java)
 * 功能: 开发场景下，将 Skills 激活率从约 25% 提升到 90% 以上
 * 技能列表覆盖全部 43 个技能（核心 15 + 扩展 28）
 */

const fs = require('fs');

let inputData = '';
try {
  inputData = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(inputData);
} catch {
  process.exit(0);
}

const prompt = (input.prompt || '').trim();

// 检测是否是恢复会话（防止上下文溢出死循环）
const skipPatterns = [
  'continued from a previous conversation',
  'ran out of context',
  'No code restore',
  'Conversation compacted',
  'commands restored',
  'context window',
  'session is being continued'
];

const isRecoverySession = skipPatterns.some(pattern =>
  prompt.toLowerCase().includes(pattern.toLowerCase())
);

if (isRecoverySession) {
  process.exit(0);
}

// 检测是否是斜杠命令
const isSlashCommand = /^\/[^\/\s]+$/.test(prompt.split(/\s/)[0]);
// 斜杠命令已被展开成命令文档注入（含 <command-name> 标签）
const isExpandedCommand = /<command-name>/.test(prompt);

if (isSlashCommand || isExpandedCommand) {
  process.exit(0);
}

const instructions = `## 强制技能激活流程（必须执行）

### 步骤 1 - 评估（必须在响应中明确展示）

针对用户问题，列出匹配的技能：\`技能名: 理由\`，无匹配则写"无匹配技能"

可用技能（base-dev-framework6-java · org.dromara/三层无DAO/BaseEntity/QueryBuilder/标准REST/Jackson3/del_flag）：
- crud-development: CRUD/业务模块/Entity/Service/Mapper/BO/VO/全栈开发/代码生成器
- api-development: API设计/RESTful/接口规范/标准REST/R<T>/接口路径
- database-ops: 数据库/SQL/建表/字典/菜单/del_flag/雪花ID/多数据源/Oracle/PostgreSQL
- code-patterns: 规范/禁止/命名/Git提交/代码风格/不能用/不允许/约定
- bug-detective: Bug/报错/不工作/排查/调试/定位/为什么/不生效
- error-handler: 异常处理/ServiceException/全局异常/GlobalExceptionHandler/错误码/日志规范
- performance-doctor: 性能/慢查询/SQL优化/索引/EXPLAIN/N+1/SqlLogInterceptor/缓存/深分页
- json-serialization: JSON/序列化/JsonUtils/Jackson/大数字/精度/BigDecimal/Long/日期格式
- utils-toolkit: 工具类/DateUtils/StringUtils/StreamUtils/MapstructUtils/TreeBuildUtils/ValidatorUtils
- test-development: 测试/单元测试/集成测试/@Test/JUnit5/Mockito/@SpringBootTest/MockMvc
- i18n-development: 国际化/多语言/i18n/MessageUtils/messages.properties/语言切换/content-language
- dev-startup: 本地启动/首次启动/跑起来/装环境/装依赖/JDK21/Maven/MySQL/Redis/端口占用/健康检查
- env-config: 环境配置/profile/application.yml/application-dev/application-prod/多环境/SPRING_PROFILES_ACTIVE
- log-audit: 操作日志/登录日志/审计/@Log/sys_oper_log/BusinessType/LogAspect/sys_login_info
- backend-annotations: 注解/@Translation/翻译/ID转名称/字典转标签/@RateLimiter/@Sensitive/@AutoMapper/分组校验
- project-navigator: 项目结构/文件在哪/目录/模块/代码位置/定位/参考代码/ruoyi-common/ruoyi-modules/ruoyi-api
- architecture-design: 架构设计/模块划分/分层/解耦/ruoyi-api/契约/模块拓扑/重构/领域划分
- security-guard: 安全/Sa-Token/@SaCheckPermission/@SaCheckLogin/@SaCheckRole/认证授权/Token/LoginHelper/加密/@EncryptField/限流/@RateLimiter/防重复/@RepeatSubmit
- redis-cache: Redis/缓存/@Cacheable/@CacheEvict/@CachePut/RedisUtils/CacheUtils/分布式锁/Lock4j/限流/缓存穿透/Redisson
- data-permission: 数据权限/@DataPermission/@DataColumn/DataScope/行级权限/数据隔离/部门权限/本人权限
- scheduled-jobs: 定时任务/SnailJob/@JobExecutor/任务调度/重试/工作流编排/@Scheduled/延迟队列
- file-oss-management: 文件上传/OSS/对象存储/云存储/MinIO/S3/AWS/预签名/SysOss/OssClient/OssFactory
- multi-tenant: 多租户/租户隔离/tenant_id/TenantHelper/动态租户/排除表/sys_tenant/数据隔离
- ui-pc: 前端/Element Plus/el-table/el-form/Ant Design Pro/ProTable/ModalForm/代码生成器前端/Vue页面/React页面/useDict
- deployment-guide: 部署/上线/发布/生产环境/Docker/Compose/Jetty/Nginx/密钥/profile/外置server/snailai-server
- html-to-code: HTML转代码/设计稿转换/原型转代码/HTML转前端/Element Plus/Ant Design Pro/区块转换
- snail-ai-integration: AI/Snail AI/SnailAI/大模型/AI对话/Agent/OpenAPI/AI集成/智能助手
- mcp-integration: MCP/Model Context Protocol/@McpTool/@McpResource/McpClientTemplate/MCP工具/MCP资源/AI工具
- elasticsearch-search: Elasticsearch/ES/Easy-Es/全文检索/搜索引擎/EsMapper/@IndexName/@IndexField/索引
- realtime-push: 实时推送/消息推送/SSE/WebSocket/PushHelper/服务端推送/广播/集群广播/通知推送
- data-desensitize: 脱敏/数据脱敏/@Sensitive/SensitiveStrategy/敏感数据/PII/掩码/手机号脱敏/身份证脱敏
- iot-mqtt: MQTT/物联网/IoT/设备通信/mica-mqtt/@MqttClientSubscribe/MqttClientTemplate/publish/subscribe/QoS/Topic
- workflow-warmflow: 工作流/流程/审批/Warm-Flow/WorkflowService/发起流程/办理任务/待办/已办/流程图/审批流
- brainstorm: 头脑风暴/方案/创意/怎么设计/有什么办法/如何实现
- task-tracker: 任务跟踪/记录进度/继续任务/恢复上下文/多步骤开发/任务归档
- writing-plans: 写计划/制定计划/实施计划/拆解任务/可执行计划/把方案落地
- git-workflow: Git/提交/commit/分支/合并/push/pull/冲突/回滚
- tech-decision: 技术选型/方案对比/用什么/哪个好/优缺点/选模块
- collaborating-with-codex: Codex协作/多模型/后端原型/算法分析/代码审查/codex-plugin-cc
- collaborating-with-gemini: Gemini协作/前端原型/UI设计/样式/代码审查
- add-skill: 添加技能/创建技能/新技能/修改技能/同步技能/技能文档
- exp-sediment: 沉淀经验/经验沉淀/总结会话/记下来/查记录/以前怎么处理/历史经验

### 步骤 2 - 激活（逐个调用，等待每个完成）

⚠️ **必须逐个调用 Skill() 工具，每次调用后等待返回再调用下一个**
- 有 N 个匹配技能 → 逐个发起 N 次 Skill() 调用（不要并行！）
- 无匹配技能 → 写"无匹配技能"

**调用顺序**：按列出顺序，先调用第一个，等返回后再调用第二个...

### 步骤 3 - 实现

只有在步骤 2 的所有 Skill() 调用完成后，才能开始实现。

---

**关键规则（违反将导致任务失败）**：
1. ⛔ 禁止：评估后跳过 Skill() 直接实现
2. ⛔ 禁止：只调用部分技能（必须全部调用）
3. ⛔ 禁止：并行调用多个 Skill()（必须串行，一个一个来）
4. ✅ 正确：评估 → 逐个调用 Skill() → 全部完成后实现

**正确示例**：
用户问："帮我开发一个优惠券管理功能"

匹配技能：
- crud-development: 涉及业务模块 CRUD 全栈开发
- database-ops: 需要建表和字典配置

激活技能：
> Skill(crud-development)
> Skill(database-ops)

[所有技能激活完成后开始实现...]

**错误示例（禁止）**：
❌ 只调用部分技能
❌ 列出技能但不调用 Skill()
❌ 并行调用（会导致只有一个生效）`;

console.log(instructions);
process.exit(0);
