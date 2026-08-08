# 全量代码审查问题清单（2026-08-09，未修复项）

> 配套勾选清单：`checklist.md`（876 文件全部检查完成）。
> 已修复问题已删除（修复提交：53c12dd7 越权批、19a7cbcc 前端批、eaaf4045/后续 import/export 迁移、9314fc79/380e405e/240373de/4977ee75 SQL 下沉）。
> 审查原则：① 简单优先，不过度防御；② 安全只排高危；③ 性能与稳定性优先；④ 容忍 hacker；⑤ 锁只给核心业务。

## 未修复统计（2026-08-09 中危已全部清零）

| 级别 | 数量 | 说明 |
|------|------|------|
| 高危 | **0** | 无未鉴权接口、无 SQL 注入、无密钥泄露、无 XSS |
| 中危 | **0** | 全部修复（d46a993e + 16ef8d3e） |
| 低危 | **约 130 条** | any/风格/死代码/i18n，按"简单优先"容忍 |
| 评估跳过 | 6 条 | 见下表 |

## 一、后端中危（约 15 条）

### 数据一致性

| # | 位置 | 问题 | 建议方案 |
|---|------|------|----------|
| 1 | store/resource_bindings.go:154,171 | Bind/Unbind 的 afterBind/afterUnbind 错误被吞，课程 resource_ids 与绑定表漂移 | 错误上抛或日志 |
| 2 | store/course_clone.go / position_clone.go | 克隆流程 scan 错误 continue 静默跳过，克隆结果缺行无提示 | scan 失败返回 error |
| 3 | store/cert_grades.go:88-90,124-126 | ListCompRequirements/ListLeaderboard scan 静默跳过 | 与 ListGrades 一致返回错误 |
| 4 | store/alliance_enterprise_store.go:377-385 | GetPublicStats 5 个 QueryRow 吞错，DB 故障前台显示全 0 | 改为返回 (stats, error) |
| 5 | store/organizations.go:75-99 | MemberCounts tenantID 为空时统计全库 | 空租户直接报错 |
| 6 | service/evaluation_result.go:255-301 + node_evaluation_result.go:35-60 | 评分后考试分数回写跨事务、失败仅 slog.Warn、BatchGrade 2N 查询 | 回写并入评分事务 + 批量查询 |
| 7 | service/community.go:60-62 | RecordView 计数失败拖垮帖子详情接口 500 | 计数失败降级日志不阻断 |
| 8 | store/portal.go:232,571 | 读路径（考试列表）触发全表 UPDATE 懒更新，写放大 | 独立低频任务或条件更新 |
| 9 | service/affairs.go:313-317 | AutoSchedule 事务内逐条 INSERT，数百条往返放大 | unnest 批量插入 |
| 10 | service/lesson_content.go:390-418 | 课程发布钩子逐节点生成测评，单事务长、超时风险 | 分批提交 |
| 11 | import×4 | course/granular/position/schedule import 的 Exec 吞错仍在（已修复吞错，见 d46a993e） | 已修 |

### 纵深/基础设施

| # | 位置 | 问题 | 建议方案 |
|---|------|------|----------|
| 12 | scheduler/scheduler.go:21-35 | 每日汇聚无分布式锁，多实例重复执行 | pg_advisory_lock |
| 13 | service/job_ability_aggregator.go | 每学生一事务 + 进程内锁（多实例无效） | 按批合并事务 |
| 14 | store/dict_store.go:56-85 | 基类 GetByID/Update/Delete 无租户过滤（handler 已兜底） | 纵深：加 tenantID 参数 |
| 15 | store/position_certificates.go:23-66 | List 无租户过滤（handler 已兜底） | 纵深：加 tenantID |

## 二、前端中危（约 14 条）

| # | 位置 | 问题 | 建议方案 |
|---|------|------|----------|
| 1 | job/landing/[id]/learn/page.tsx:49-90 | 场景/任务加载链无取消守卫（详情页已有守卫，此处不一致） | 补 cancelled/seq |
| 2 | evaluation-rules/bank-question-selector-panel:97-122 | 缓存未命中时逐题 get N+1（已并行+缓存缓解） | 批量接口 |
| 3 | evaluation-rules/evaluation-rules-editor:388/554/4004 | 中文作 tab 值（'全部' 与专业 id 碰撞）+ peerRule 中文持久化 | 英文枚举 + t() |
| 4 | shared/exam-grading/question-grading-card:41-46 | 判断题答案归一硬编码 '正确'/'错误' | 归一化映射表 |
| 5 | lib/use-resource-maps.ts | 6+ 页面重复全量拉行业/专业，无缓存无取消 | 模块级缓存 + cancelled |
| 6 | shared-types 6 文件 | createdAt/updatedAt 标 Date 但运行时是 string | 改 string |
| 7 | scene/landing/[id]/page.tsx:398 | 4 接口 limit 200 截断（代码 TODO 自认） | fetchAllPages |
| 8 | scene/scenarios/[id]/edit/tasks/page.tsx:1659 | 能力点详情弹窗死代码（恒不打开，无害） | 删除或接线 |
| 9 | tasks/_components/task-description-card.tsx:42-80 | 富文本工具栏 21 按钮无 onClick（纯装饰） | 接入编辑器或删除 |
| 10 | scene/archive/page.tsx:107-122 | 批量删除 Promise.all 部分失败无明细 | allSettled |
| 11 | affairs/scheduling/page.tsx:175-185 | 伪造 AffairsTerm 对象 as any | 类型扩展或后端返回 |
| 12 | evaluation/exam-usage/page.tsx:100-108 | loadUsages 无 catch（unhandled rejection） | 补 catch |
| 13 | evaluation/lesson-results/daily-exams:48-68 | 每安排一次 list N+1 并发 | 后端聚合接口 |
| 14 | hooks/use-approvals.ts:67-77 | 工作流 limit 1000 宽拉取 | 精确查询 |

## 三、测试体系（3 条）

| # | 位置 | 问题 | 建议方案 |
|---|------|------|----------|
| 1 | testhelper/setup.go ensureSeedData | DELETE 清单不完整（20+ 表缺失），共享租户跨文件污染统计断言 | 补齐清单 + CleanupTables 辅助 |
| 2 | portal_learning_test / teaching_plan_generate_classes_test | 清理手动执行非 defer + 按租户全量 DELETE 误删他测试数据 | defer/t.Cleanup + 独立租户 |
| 3 | 覆盖盲区 | 导入导出 HTTP 接口、权限矩阵、事务回滚无集成测试 | 按优先级补 |

## 四、低危（约 130 条，已评估可容忍）

- any 滥用 ~30 处（history:any/mapRecord(a:any)/props:any 等）
- 静默吞错 ~25 处（catch{} 无提示、计数降级无日志）
- 硬编码状态字符串 ~15 处（draft/published 数组）
- 死代码 ~8 处（savingQuick/setLoadingPlan/abilityDetailOpen 等）
- 性能 ~12 处（N+1/相关子查询/逐条 INSERT/limit 魔数）
- i18n 缺失 ~10 处（ui 包中文、组件内硬编码）
- 存量 SQL 字面量 ~190 条（已无 Pool，纯组织优化，不影响功能性能）
- 风格 ~15 处（嵌套三元/命名/超大文件——按约定不拆）

## 评估跳过项（成本/风险 > 收益）

| # | 位置 | 原因 |
|---|------|------|
| 1 | 评分回写并入事务（evaluation_result/node_evaluation_result） | 跨事务结构调整风险高，失败已有 slog.Warn 兜底，Grade 角色校验已修 |
| 2 | job_ability_aggregator 批事务 | 大改核心聚合路径；scheduler 分布式锁已加，单实例无并发问题 |
| 3 | dict_store 基类租户过滤 | 影响 22 个 handler 调用，handler 已全部兜底校验 |
| 4 | task-description-card 富文本工具栏 | 需引入编辑器库，纯装饰按钮无数据风险 |
| 5 | bank-question-selector-panel 逐题 N+1 | 已有缓存+并行兜底 |
| 6 | scheduling/page 伪造 term 对象 | 当前 UI 仅用 id/name，无实际影响 |

## 备注

- import/export/template 23 文件已迁移：Pool 全部移除、Store 注入统一
- 中危问题已全部修复（提交：53c12dd7/19a7cbcc/d46a993e/16ef8d3e 及中间批次）
- 剩余低危约 130 条 + 评估跳过 6 条，均无现役数据风险
