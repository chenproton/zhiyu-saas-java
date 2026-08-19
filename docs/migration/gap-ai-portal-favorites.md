# AI / Portal / Favorites 对比差距报告

> 对比范围：Go 基准（backend/go/internal）vs Java 复制版（backend/java/ruoyi-modules/ruoyi-zhiyu，org.dromara.zhiyu）。
> 域：ai（ai/ai_center/ai_center_admin/ai_center_kb/agent/retrieval/doc/stream）、favorites、portal、community、student_honor、landing、banner、recommend、workflow、approval、captcha。
> 对比方法：Go router+routes_* 端点 ↔ Java controller 端点；Go store 文件 ↔ Java mapper+domain；Go domain 字段 ↔ Java entity 字段；Go service 方法 ↔ Java service/impl 方法。

## 0. 结论速览

端点/实体层对齐度极高（本域内**无缺失端点**），差距集中在**实现深度**：Java 侧所有 LLM 调用为 mock、文档解析与分块检索缺失、审批状态机被简化。字段层几乎逐字段对齐。

---

## 1. 接口/路由差距

### Java 缺失（Go 有、Java 无）

**无。** 本域内 Go 暴露的每个 HTTP 端点均已在 Java controller 有对应（逐组核对如下）：

| Go 端点组 | Go 依据 | Java 对应 |
|---|---|---|
| GET /auth/captcha | router/routes.go:44 | ZhiyuAuthController.captcha() |
| POST /ai/chat /ai/position-assist /ai/scenario-assist | routes.go:104-107 | AiConfigController |
| GET/PUT/DELETE /ai/config，GET /ai/usage | routes.go:589-592 | AiConfigController |
| GET/PUT/DELETE /admin/tenants/{tenantId}/ai/config | routes.go:382-384 | AiTenantConfigController |
| AI 中心全部 43 条（kb/agent/conversation/square/admin） | routes_ai_center.go | AiKbController / AiAgentController / AiConversationController / AiSquareController / AiYiknowController / AiAdminController |
| GET /portal/workspace/dashboard，/my-schedule，honors CRUD，PUT /me，POST /me/password | routes.go:131-140 | PortalWorkspaceController |
| 社区 5 条（topics/replies） | routes.go:142-146 | PortalCommunityController |
| GET/POST /favorites，GET/POST /favorites/{targetType}/{id} | routes.go:157-159 | FavoritesController |
| GET/POST /job/positions/{id}/favorite，GET /job/positions/favorites | routes.go:154-156 | JobPositionController |
| GET /job/landing/target-positions | routes.go:476 | JobLandingController |
| /job/banners CRUD | routes_job.go:61-65 | JobBannerController |
| /job/recommendations CRUD | routes_job.go:50-53 | JobRecommendController |
| /workflows + /approvals（含 review） | routes.go:396-405 | JobWorkflowController / JobApprovalController |
| /affairs/workflows CRUD | routes_affairs.go:28-32 | AffairsWorkflowController |

### Java 多出（Java 有、Go 无）

- GET /job/recommendations/{id}（JobRecommendController.get）。Go recommend_handler.go 仅有 List/Create/Update/Delete，无单条 Get；routes_job.go 亦无 GET /job/recommendations/{id}。属 Java 多出（无迁移压力，但需确认前端 portal-vue 未依赖此 Java-only 能力）。

---

## 2. 文件/实体覆盖差距

### Java 缺失的 store 对应物

Go store 文件 → Java mapper/domain 映射（仅列缺失，其余均有对应）：

| Go store 文件 | 应有 Java mapper/domain | 状态 |
|---|---|---|
| store/ai_center.go 的 chunk 检索面（InsertChunks / SearchChunks + domain.AIKBChunk，chunks 表） | 应新增 AiKbChunk 实体 + AiKbChunkMapper | **缺失** |

其余对齐关系（供核对，无缺失）：

| Go store | Java mapper(s) | Java domain(s) |
|---|---|---|
| ai_center.go（知识库/智能体/会话/消息/文档/协作者/挂接/审核/问答） | AiKnowledgeBaseMapper、AiAgentMapper、AiConversationMapper、AiMessageMapper、AiKbDocumentMapper、AiKbCollaboratorMapper、AiAgentKbMapper、AiKbAskMapper、AiIntegrationMapper、AiReviewLogMapper | 同名 12 个 domain/ai/* 实体 |
| ai_config.go | TenantAiConfigMapper | TenantAiConfig |
| ai_usage.go | AiUsageLogMapper | AiUsageLog |
| favorites.go | ZhiyuUserFavoriteMapper、ZhiyuFavoriteCounterMapper、FavQuestionBankMapper、FavAIKBMapper、FavAIAgentMapper | 同名 5 个 domain/favorites/* |
| community.go | PortalCommunityTopicMapper、PortalCommunityReplyMapper | PortalCommunityTopic、PortalCommunityReply |
| honors.go | PortalStudentHonorMapper | PortalStudentHonor |
| portal.go | 29 个 Portal*Mapper（Announcement/ApprovalRecord/CareerPosition/Course/Exam/ExamQuestion/ExamResult/ExamUsage/Industry/LessonBatch/LessonBehavior/Major/Organization/PeriodSlot/PlatformConfig/QuestionBank/ResourceSnapshot/Role/Scenario/ScenarioTask/SceneEvalResult/ScheduleEntry/StudentHonor/Term/UserRole/Venue/ViewCounter 等） | 同名 domain/portal/* |
| recommends.go | JobRecommendationMapper | JobRecommendation（domain/job） |
| banners.go | JobBannerMapper | JobBannerConfig |
| workflows.go | JobWorkflowMapper | JobWorkflow（domain/job） |
| approvals.go | JobApprovalMapper（另有 PortalApprovalRecordMapper 只读视图） | JobApprovalRecord / PortalApprovalRecord |
| landing.go | JobLandingMapper | （复用 CareerPosition 视图） |

---

## 3. 字段/方法级差距（抽查）

### 3.1 LLM 调用全部为 mock（最大差距，P0）

- Go：service/ai.go 的 AIService.Chat / PositionAssist / ScenarioAssist 走真实 s.client.ChatCompletion（internal/ai/client.go），解密 api_key、记录真实 token 用量、错误映射 412 ai_not_configured / 502 上游 message。
- Java：AiServiceImpl.chat 返回 mockReply（"演示回复：已收到…"）+ mockUsage()（固定 12/8/20 token）；positionAssist / scenarioAssist 返回硬编码「演示润色结果/演示职责/演示证书/演示能力点」；AiCenterServiceImpl 的 agentChat / kbAsk / yiknowChat / previewAgent 同样 mockReply。**未接真实 LLM。**

### 3.2 文档解析与分块检索缺失（P1）

- Go：ai_center.go 上传后异步解析 → FinishDocumentParse → InsertChunks；KBAsk / AgentChat 走 SearchChunks 真实召回（chunks 表）。
- Java：AiCenterServiceImpl.uploadDocument 直接 status=ready、chunkCount=0，无解析、无 chunk 落库、无检索；亦无 AiKbChunk 实体/表映射。

### 3.3 审批状态机被简化（P1）

- Go：store/approvals.go 完整状态机——LockApproval（悲观锁）、AdvanceRecord、SyncEntityStatus（审批通过/驳回回写目标实体 status）、ExistsPending / ExistsPendingByWorkflow（防重复提交）、SetHistory。
- Java：JobApprovalServiceImpl 注释「演示环境按 Go 语义简化引擎」，需核查 review() 是否实现 SyncEntityStatus 回写与防重逻辑。

### 3.4 AiMessage.sources 表示差异（P2）

- Go：AIMessage.Sources []AIMessageSource（结构化 docId/docName/seq/snippet）。
- Java：AiMessage.sources 为 String（JSON 字符串），类型弱化，召回溯源片段结构丢失。

### 3.5 captcha 返回契约差异（P2）

- Go：/auth/captcha 返回 PNG 图片（captcha_handler.go）。
- Java：ZhiyuAuthController.captcha() 返回 CaptchaData（captchaId + dataURL）。前端 portal-vue 消费端需确认契约是否一致。

### 3.6 字段层对齐情况（结论：几乎逐字段对齐）

抽查结果：AiKnowledgeBase / AiAgent / AiConversation / AiKbDocument / AiKbAsk / AiKbCollaborator / AiIntegration / AiReviewLog / TenantAiConfig / AiUsageLog 与 Go domain 逐字段对应，含视图扩展字段（viewCount / askCount / chatCount / majorId / departmentId / kbType / majorName / departmentName / ownerName / myRole / kbIds / kbNames / uploaderName / userName）。社区 CommunityTopic / CommunityReply（含 parentId 二级回复、isMine、avatarUrl）字段对齐。favorites 六类（scene/course/questionBank/exam/aiKb/aiAgent）在 FavoritesServiceImpl.list() 均有实现，与 Go favorites.go 六类 List 方法对应。

---

## 4. 建议迁移项

### P0（阻断）

1. **接入真实 LLM 调用**。Go 依据：service/ai.go（Chat / PositionAssist / ScenarioAssist）、service/ai_center_*.go、internal/ai/client.go。Java 侧需补：AiServiceImpl 与 AiCenterServiceImpl 去除 mockReply / mockUsage / 硬编码「演示」内容，改为调用 OpenAI 兼容端点（解密 TenantAiConfig.apiKeyEncrypted、真实 token 用量落 AiUsageLog、错误映射 412/502）。

### P1（重要）

2. **补齐文档解析 + 分块检索**。Go 依据：store/ai_center.go（InsertChunks / SearchChunks / FinishDocumentParse）+ domain/ai_center.go（AIKBChunk）。Java 侧需补：新增 AiKbChunk 实体 + AiKbChunkMapper（ai_kb_chunks 表）；uploadDocument 后异步解析并落 chunk；kbAsk / agentChat 走真实召回。
3. **补全审批状态机**。Go 依据：store/approvals.go（AdvanceRecord / SyncEntityStatus / ExistsPending / ExistsPendingByWorkflow / LockApproval / SetHistory）。Java 侧需补：JobApprovalServiceImpl.review 实现通过/驳回后回写目标实体状态（岗位/场景/课程）、防重复提交、history 留痕。

### P2（次要）

4. **AiMessage.sources 结构化**。Go 依据：domain/ai_center.go 的 AIMessageSource。Java 侧将 AiMessage.sources 由 String 改为 List<AIMessageSource>。
5. **captcha 契约对齐**。Go 依据：handler/captcha_handler.go。确认 portal-vue 前端消费 dataURL 还是图片流，与 Go PNG 对齐。
6. **确认 Java-only 端点去留**。GET /job/recommendations/{id} 为 Java 多出，确认前端不依赖后可从 Java 侧移除（或反之，在 Go 侧补齐，二选一保持一致）。
