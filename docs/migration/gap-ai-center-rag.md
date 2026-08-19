# Java↔Go 迁移报告：AiKbChunk 文档分块 + AI 中心 RAG 对话（P0-5c）

> 分支 feat/agent-align-remaining · 对齐对象 backend/go（功能基准）· Java 侧 backend/java/ruoyi-modules/ruoyi-zhiyu

## 任务
把 Java AI 中心的文档上传「直接置 ready、chunkCount=0」改为「真实分块入库」，把 agentChat / kbAsk / yiknowChat（及 previewAgent）从 mock 改为「pg_trgm 检索 + 真实 ChatCompletion」。

## 改动清单（仅本任务相关文件）

| 文件 | 改动 |
|---|---|
| domain/ai/AiKbChunk.java | 新增实体：id/tenantId/docId/kbId/seq/content/createdAt + docName(召回 JOIN 填充，exist=false)。对齐 Go AIKBChunk（chunks 表无 embedding/chunk_index/token_count，仅 seq+content）。 |
| mapper/ai/AiKbChunkMapper.java | 新增 insertBatch（批量插入，id 走 PG gen_random_uuid 默认值）+ searchChunks（pg_trgm 相似度召回 + SQL 层可见性过滤 published/owner/协作者，greatest(similarity(...)) 跨子句取最大）。 |
| mapper/ai/AiKbDocumentMapper.java | 新增 finishParse（parsing→ready/failed，WHERE status='parsing' 状态守卫，对齐 Go FinishDocumentParse）。 |
| mapper/ai/AiKnowledgeBaseMapper.java | 新增 refreshDocCount（重算 ready 文档数冗余列，对齐 Go RefreshKBDocCount）。 |
| service/impl/ai/AiCenterServiceImpl.java | ① uploadDocument：登记 parsing → 同步解析（PDF/DOCX/TXT/MD）→ chunkText 分块 → insertBatch 入库 → finishParse(ready) + refreshDocCount；失败标记 failed。② kbAsk/agentChat：RAG 检索 + 拼 context + 真实 ChatCompletion + 溯源落库 + 计数。③ yiknowChat/previewAgent：真实 ChatCompletion（无检索，对齐 Go）。④ 新增 retrieveChunks/buildRetrievalQueries/buildChatMessages/chunksToSources/extractDocText/chunkText 等对齐 Go 的纯逻辑。 |
| service/ai/ChatStreamResult.java | 记录新增 sources 组件（召回溯源），供 controller 发射 SSE sources 事件。 |
| controller/ai/AiWeb.java | SSE 流新增 sources 事件（非空时在 delta 前发射）。 |
| pom.xml | 新增 org.apache.pdfbox:pdfbox:3.0.7（PDF 文本提取，对齐 Go ledongthuc/pdf）。 |

## 编译结果

- 最终全量编译 **exit 0**：`cd backend/java && ./mvnw -o -q -pl ruoyi-modules/ruoyi-zhiyu -am compile`，产出 AiKbChunk.class / AiKbChunkMapper.class / AiCenterServiceImpl.class / ChatStreamResult.class / AiWeb.class 等字节码。
- 说明：编译期间同仓库并行迁移子代理正在改 service/impl/importexport/ImportExportServiceImpl.java（importBrands 重构，未提交 WIP），其 WIP 期间曾短暂导致全模块编译失败；本任务未改动该文件（契约红线：不覆盖他人代码），待其收口后已恢复 exit 0。

## 已知简化点

1. 同步解析：Go 上传后异步 goroutine 解析（5min 超时 + panic recover）；Java 改为请求内同步解析（简单、可运行优先）。
2. 文件不落盘：Go handler 先落盘再解析；Java 从 MultipartFile 内存字节直接提取文本，filePath 保留占位（@JsonIgnore 不外泄），deleteDocument 亦不清理物理文件（与 Java 既有行为一致）。
3. LLM 非流式：Go 走 ai.Client.ChatCompletionStream；Java 复用 IAiService.chat（非流式真实 HTTP），由 AiWeb 客户端合成 SSE delta 分片。
4. 上游错误映射为 HTTP：Go 流中途失败经 SSE error 事件下发、不落残缺 assistant 消息；Java 上游 502 直接抛 ApiException(502)，此时已落库的 user 消息可能成为无回复孤儿（非流式架构限制）。
5. 历史上下文排序：Go ListRecentMessages 以 created_at,id 双键排序；Java 仅 created_at 倒序取 10 再 reverse（id 二级排序省略）。
6. 检索实现：Go 用 pg_trgm similarity（非 embedding 向量），Java 直接复用同库 pg_trgm 扩展，无关键词/ILIKE 退化；分块切片用 Java codePointCount 语义对齐 Go rune。
7. DOCX 提取：Go 手写 zip+xml；Java 用已有 POI XWPFWordExtractor（poi-ooxml 已在类路径）。

