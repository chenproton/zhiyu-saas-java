# 前后端代码审查 · 遗留问题重新评估（交付版）

> 本文档对上一版「遗留问题清单」中的全部「评估后不改」项做了一轮**逐条对照代码的重新评估**，推翻其中收益被低估的部分，按「建议改 / 可选 / 保持不改」三档重分类，供交付决策。
> 结论口径：P0（安全/数据损坏）、P1（性能/稳定性）已于前轮修复清零；本清单所有条目均为 P2（维护性/复用）或复用候选。重新评估后，**其中一部分其实改动成本小、收益明确，建议交付前随手处理**；其余维持「不改」的理由经代码核验仍然成立。

---

## 一、重新评估结论速览

| 档位 | 含义 | 条目数 | 交付建议 |
|---|---|---|---|
| **A 档：建议改** | 几行~几十行机械改动，收益明确（真 bug / 正确性 / 可见数据错误 / 双实现漂移） | 见下 | 交付前处理 |
| **B 档：可选** | 成本中或收益中，可渐进 / 交付后优化 | 见下 | 视工期取舍 |
| **C 档：保持不改** | 产品决策 / 需后端配套 / 纯技术债，原评估成立 | 见下 | 维持不变 |

---

## 二、A 档 —— 建议改（成本小、收益明确）

### 后端（backend/internal/store，单目录内机械改动，合计约 70~80 行，无方法签名变更）

| # | 问题 | 文件 | 改动 | 成本 | 收益 |
|---|---|---|---|---|---|
| A1 | `favorites.go` ToggleFavorite 计数漂移（并发双点收藏，ON CONFLICT no-op 仍 cnt+1，收藏数真实漂移） | `favorites.go` | INSERT/DELETE 取 `tag.RowsAffected()`，>0 才 ±1（~4 行） | 小 | 高（正确性 bug） |
| A2 | `exam_results.go` FetchUserProfile 两处 `_ =` 吞错（姓名/班级查询失败静默落空，且函数永不返回 err，调用方 err 检查是死代码） | `exam_results.go` L353/354 | 改为捕获 err 后 `slog.Warn`（~4 行，沿用 auth.go 既有模式） | 小 | 中（可观测性） |
| A3 | `courses.go` Delete 中不可达的 `course_evaluation_results` DELETE（与同事务 EXISTS 检查互斥） | `courses.go` L175 | 删除 L175-177 三行（死代码） | 小 | 低（死代码清理） |
| A4 | `exam_usages.go` Get 触发全表 UPDATE（`SyncScheduledExamUsageStatus` 传空串走无租户全表写放大） | `exam_usages.go` L63 | 传 `tenantID` 替代 `""`（1 行） | 小 | 中（写放大收窄为租户级） |
| A5 | `community.go` COUNT/列表 where 条件双份维护 | `community.go` L78-94 | 拼一个 where 串，COUNT 与列表复用（~10 行） | 小 | 中（防漂移） |
| A6 | `content_actions_test.go` transitionMatrix 与实现常量双份（逐字一致靠人肉同步） | `content_actions_test.go` L10-17 | 删副本改引用实现 `allowedStatusTransitions`（~8 行，纯测试文件） | 小 | 中（防测试失真） |
| A7 | `question_banks.go` fetch 三份逐字重复扫描体（fetchBank/fetchBankScoped/ScanQuestionBankRows） | `question_banks.go` | 合并为一份共享实现（可选租户谓词）（~40 行） | 小-中 | 中（列变更改 3 处 → 1 处） |

### 后端 —— 跨层透传（纯机械，需改方法签名；handler 已校验，属「漏校验即 IDOR」纵深防御）

| # | 问题 | 文件 | 改动 | 成本 | 收益 |
|---|---|---|---|---|---|
| A8 | `exams.go` 题目增删改分（RemoveQuestion/UpdateQuestionScore/BulkUpdateScores/RecalcExamTotal）SQL 无租户条件 | `exams.go` + service + handler 透传 | 4 个 store 方法加 tenantID + `AND tenant_id=$n`（exam_questions 表本身有 tenant_id 列） | 中 | 中（与 AddQuestion 惯例对齐） |
| A9 | `course_assessments.go` CreateTempExam check-then-act 撞唯一键 500 | `course_assessments.go` L127-149 | INSERT 后捕 `pgx.ErrUniqueViolation` → 重查返回已有（~6 行） | 小 | 中（500 变正常复用） |
| A10 | `position_clone.go` FetchPosition 与 `positions.go` fetchPosition 近逐字重复（30 行 SELECT） | `position_clone.go` + `positions.go` | 抽包级 `fetchCareerPosition`，克隆版改调共享函数（~30 行） | 小-中 | 中（单点维护） |

### 前端（apps/edu，均为几行机械改动）

| # | 问题 | 文件 | 改动 | 成本 | 收益 |
|---|---|---|---|---|---|
| A11 | **hover 动态 Tailwind 类失效（真 bug，非性能）**：`hover:${opt.border}` 构建期无法静态提取 → hover 边框/底色静默不生效 | `lesson/admin/system/add/page.tsx` L1137-1149 | opt 对象加 `hoverBorder`/`hoverBg` 完整字面量字段（~6 行） | 小 | 中（修复不可见交互） |
| A12 | **答案文本被 t() 误翻译**：`t(getAnswerLabel(answer))` 把答案当 i18n key，判断题答案「正确」/英文 'ok' 会被误翻译 | `components/shared/exam-grading/question-grading-card.tsx` L331/354/360 | 去掉 3 处 `t()` 包裹 | 小 | 中（答案显示正确性） |
| A13 | **YearView 事件错月**：`e.dayOfWeek % 4 === m % 4` 伪逻辑把事件塞进无关月份 | `portal/workspace/_components/workspace-schedule-grid.tsx` L549 | 按 `e.date?.slice(0,7)` 归月（~5 行，参照同文件 L491 MonthView 写法） | 小 | 中（可见数据错误） |
| A14 | `my-resources` 五列表单 `limit:200` 截断（创作者 >200 条自有内容静默缺失，已有 TODO 注释） | `library/my-resources/page.tsx` L124/137/150/163/177 | 5 处换 `fetchAllPages` | 小 | 中（数据完整） |
| A15 | `job-ability` 列表 `limit:200` 截断 + `exams/page.tsx` err 弱类型 | `evaluation/job-ability/page.tsx` L50、`exams/page.tsx` L86 | 2 处换 fetchAllPages + err 类型化 | 小 | 中（数据完整） |
| A16 | `use-task-datasets.ts` 7 处 + `scene/landing/[id]/learn` 4 处 `limit:1000` 截断 | `use-task-datasets.ts`、`scene/landing/[id]/learn/page.tsx` | 逐处换 fetchAllPages | 小 | 中（数据完整） |
| A17 | `tasks/page.tsx` handleSaveDraft/handleFinish 主体重复（~30 行仅 toast/跳转不同） | `scene/scenarios/[id]/edit/tasks/page.tsx` L1315-1350 | 抽 `saveAndGuardDraft`（~10 行） | 小 | 低-中（DRY） |

### packages（机械重构，防漂移 / 用户可感知一致性）

| # | 问题 | 文件 | 改动 | 成本 | 收益 |
|---|---|---|---|---|---|
| A18 | `api-helpers.ts` requestWithPlatform/authedFetch 401 逻辑双份（双实现漂移是真实正确性风险） | `packages/api-client/src/api-helpers.ts` | 抽 `handleUnauthorized(platform)` 共用（~15 行） | 小 | 中（认证处理单点） |
| A19 | `status.ts` 中英双键配色不一致（同一「进行中」跨页面一蓝一绿，92 处共享徽章） | `packages/shared-types/src/status.ts` | 5-6 对同义键别名到单一配置（~10 行） | 小 | 中（用户可感知一致性） |
| A20 | `PlatformSideNav` 展开态折叠不粘滞 + effect 依赖不稳定 | `packages/ui/.../PlatformSideNav.tsx` | effect 不再并回 defaultExpanded（记录用户折叠集）、收敛依赖（~15 行） | 小 | 中（UX 缺陷） |
| A21 | 路径激活匹配 5+ 处内联重复，且 `top-nav.tsx` 副本已语义退化（缺 `$` 精确匹配） | `platform-shell/utils.ts` + 5 处内联 | 抽 `isPathActive` 统一替换，行为等价 | 中 | 中（消除退化副本） |
| A22 | `navigation-config.ts` userMenuItems 重复 7 次 + `menu-permissions.ts` 审批 actions 重复 4 次 | `navigation-config.ts`、`menu-permissions.ts` | 抽常量（1 const + 7 处 / 1 const + 4 处） | 小 | 中（防配置漂移） |
| A23 | `resource-type-constants.tsx` 四张 11 键并行映射 | `resource-type-constants.tsx` | 单 per-type 元数据对象派生 6 导出，消费方零改动 | 小-中 | 中（新类型漏配直接编译报错） |
| A24 | `external-links.ts` 六平台地址回退演示 http（正式 https 部署漏配即混合内容静默失效） | `deploy.sh` + `.env.example`（不改应用代码） | 生产模式校验 `NEXT_PUBLIC_*_PLATFORM_URL` 必填 | 小 | 中（部署链路闭环） |
| A25 | `lesson/landing/[id]/page.tsx` typeColors 在 `resList.map()` 回调内每项重建对象（原报告误标为 scene，实际在 lesson） | `lesson/landing/[id]/page.tsx` L498 | 提升为模块级常量（~8 行） | 小 | 低（微小性能） |

---

## 三、B 档 —— 可选（成本中或收益中，可渐进 / 交付后优化）

| # | 问题 | 文件 | 建议 | 成本 | 收益 |
|---|---|---|---|---|---|
| B1 | dict 类 store + organizations.go Get/Update/Delete 无 SQL 租户限定（crud 框架 CheckOwnership 已闭环，纯纵深防御） | `dict_store.go` + 各 dict handler + `organizations.go` | 泛型基类加 tenantID 参数，渐进收口 | 中-大 | 中 |
| B2 | `partner_store.go` ListCooperation jsonb enterprise_ids 过滤无 GIN 索引 | `partner_store.go` + 新 migration | 谓词改 `@>` + 补 GIN 索引；表增长后再做 | 小-中 | 中-低 |
| B3 | `position_bindings.go`/`position_certificates.go` 无租户限定方法 | 两 store + handler | 至少补契约注释（零风险）；SQL 补租户成本偏高 | 注释小/签名中 | 低-中 |
| B4 | `random_draw_questions.go`/`resource_library.go` Delete 无 beginner nil 校验 | 两文件各 L70/L319 | 各加 3 行 nil 校验，对齐既有惯例 | 小 | 低 |
| B5 | `student_portraits.go`/`tenant_admins.go`/`users.go` 写操作无租户限定 | 多 store + service + handler | 优先 ResetPassword/UpdateStatus（高敏写），渐进 | 中 | 中 |
| B6 | 角色 user_count±1 维护 7+ 处重复（守卫形态不一） | `users.go`/`tenant_admins.go`/`roles.go` 等 | 抽 `adjustRoleUserCount` helper | 中 | 中 |
| B7 | `tenants.go` CreateWithDefaults TOCTOU（唯一约束已兜底） | `tenants.go` L419 | 捕 `ErrUniqueViolation` 映射 `ErrCodeExists`（~5 行） | 小 | 低 |
| B8 | `scene-results/[id]` 评分卡 80 行重复 + 4 处 fetchAllPages 岗位/批次 map | `scene-results/[id]/page.tsx` 等 | 抽通用 GradingCard + usePositionBatchMaps | 中 | 中 |
| B9 | `job/landing/[id]` LoginPrompt 双份（26 行完全相同） | 两 landing 页 | 提到 shared | 小 | 低 |
| B10 | 资源归一化 3 份重复 / 五级能力等级 2 处精确重复 / temp-id 3 文件重复 | 多个文件 | 抽 helper（归一化、能力等级精确重复、temp-id） | 小 | 低-中 |
| B11 | 登录/操作日志两页重复（已有 log-table-shell 抽了大头，剩余 ~60-70 行/页） | `logs/login` + `logs/operation` | 配置化 LogPage | 中 | 中 |
| B12 | `question_grading` 之外的 ACCENT_CLASSES 双份映射（仅 2 处） | `landing-filter-row` + `landing-pagination` | 抽 `lib/accent-classes.ts`（可与 A11 合并） | 小 | 低 |
| B13 | `schoolList` 15 个同构方法 / `exportByIds` 10 个 export\*Excel / alliance CRUD 工厂 | `partner-cobuild.ts`、`import-export.ts`、`alliance.ts` | 工厂化收敛 | 小 | 中-低 |
| B14 | `alliance-links.ts` 协议/项目同步串行且失败部分同步 | `alliance-links.ts` | 前端先加 Promise.all（~2 行）；完整原子需后端批量端点另行立项 | 小（前端）/大（后端） | 中 |

---

## 四、C 档 —— 保持不改（原评估经代码核验成立）

| # | 问题 | 不改理由（核验后确认） |
|---|---|---|
| C1 | 未认证 401 vs 403 语义不一致（~100 处） | 中间件已前置拦截，这些分支实际不可达；改 403→401 影响前端判断，零功能收益 |
| C2 | certificate_library URL NULL 与空串并存 | 列语义等价、消费端无差别，归一化收益配不上迁移成本 |
| C3 | 认证项/题库「空数组=未传」语义 | 前端总是全量提交，是契约非缺陷 |
| C4 | migration 094 跨租户回填 | 历史迁移已应用不可改，仅当发现实际错配数据才补修复迁移 |
| C5 | `lesson_content.go` CitationStats 4 子查询 + `imports.go` 逐名 SQL | 低频页面，SQL 重写有回归风险，收益不确定 |
| C6 | `portal.go` 统计查询 nil 租户返回全平台计数 | handler 恒传租户，nil 分支不可达，收紧属过度改造 |
| C7 | `questions.go` BatchCreate GenerateEntityCode 无重试 | 碰撞概率 ~1e-7，符合「小概率异常宁可容忍」 |
| C8 | `tenant_admins.go` NewPassword 明文回传 | 一次性初始密码属产品设计，明文不落库不落日志 |
| C9 | `student_portrait` Generate 用 context.Background | 刻意脱离请求上下文防客户端断开中断 30 分钟聚合，根治需异步化（单独立项） |
| C10 | `course_nodes.go` Delete check-then-act 竞态 | 概率极低 + FK 级联兜底；修复需 FOR UPDATE，语义微妙 |
| C11 | `scenario_clone.go` FetchSource 与场景 fetch 差异 | 仅 13 平铺列无 join，合并耦合不值 |
| C12 | 双往返模式（Get→Update→Get）5+ 处 | 库内惯用「改后回读」风格，每次仅 2 条廉价查询 |
| C13 | 终态可编辑（approved/published/archived 可编辑）+ 拖拽多次 PUT | 与共享状态机 `save_draft` 流转定义一致；dragTargetRef 已防同位置重复，最终一致性由最后落点保证 |
| C14 | 场景任务链保存串行 2-3 个 API | 并行化需重排临时 id 迁移与 409 权重时序，触及状态迁移核心，收益不抵风险 |
| C15 | 双 alliance-detail-shell 平行实现 | 两种 props 契约 + 文件头已注释职责边界，合并回归面 10 页 |
| C16 | 工作台 mock 数据 / 硬编码跳转（演示占位） | 产品/后端排期缺口，前端无法独立解决（YearView 事件错月已在 A13 单列） |
| C17 | 毕业年份筛选仅当前页 / generateRoleCode 前端算后缀 | 需后端查询参数/生成编码，前端无解 |
| C18 | 初始密码 toast 明文 / 联系电话双写 | 产品设计 / 需先对齐后端字段语义 |
| C19 | 知识/课程 landing 无分页全量渲染 / 编辑时新建颗粒课立即落库 | 产品形态 / 明确交互决策 |
| C20 | listEvaluationMethods N+1（已 Promise.all 并行） / evaluateeId 可空 | 已并行无正确性问题 / 后端已强制 UserID 过滤零收益 |
| C21 | `scene-mock.ts` 迁移 / jsonb Record<string,any> / resourceConfig 开放袋 | 类型模型重构成本大收益低 / 自由 jsonb 有意镜像 / 跨模块开放负载 |
| C22 | `module-serialize`/`evalData` 多处 any | 跨包判别联合类型，触及全部消费方，无用户可见收益 |
| C23 | knowledge-selector 挂载即拉 + 并发无上限 / eval-method-card 中文 key | 数据是筛选必需项 / 与库内明文 i18n 约定一致 |

---

## 五、交付建议

1. **A 档（25 条）建议交付前处理**：全部为「几行~几十行、零逻辑风险」的机械改动，其中含 3 个**真 bug**（A11 hover 失效、A12 答案误翻译、A13 事件错月）与 1 个**正确性 bug**（A1 计数漂移），收益明确、成本极低。
2. **B 档（14 条）视工期取舍**：多为「纵深防御 / DRY / 收敛」，其中 B7/B4 仅几行可顺手做，B1/B5 涉及租户纵深防御可渐进，其余可交付后优化。
3. **C 档（23 条）维持不改**：重新核验后原「评估后不改」理由全部成立。

> 三档合计 62 个槽位，覆盖原 68 条遗留项（数量差异来自：重新评估中发现 2 条实为「此前已修复/已消除」（exam-usage 初始加载重复、部分 typeColors 已收敛），以及后端 #7/#18/#23 等条目在按「改/不改」分体后槽位合并）。如需，我可按 A 档清单逐条实施修改并走 `deploy.sh` 分支部署验证。
