# 复查：handler 层第 4 批（2026-08-08）

> 范围：`cat /tmp/opencode/h2-ad` 列出的 20 个文件。重点：上轮已修项回归、上轮遗漏、新问题。
> 支持证据已核对：crud.go（骨架）、common.go（helpers）、store 层（learn_roads/micro_cert/node_evaluation_results/node_quizzes/lesson_content/lesson_behaviors/banners/resource_bindings/landing）、router 路由注册。
> 上轮修复项回归结论：越权/租户隔离、500 统一 respondServerError、learn_roads/on-site 部分更新回填 —— 均已正确实现，无回归。

---

## backend/internal/handler/job_ability_result_handler_test.go

- [P1][测试] job_ability_result_handler_test.go:91-94 — 回退胜任度断言公式 `((85-70)/70*0.6+0)*100` 中 `(85-70)/70` 是 **Go 整型常量除法** = 0，故 `wantComp=0`；而实现 `computeAbilityIndicators`（job_ability_result_handler.go:173）用 float64 计算 `(85-70)/70*0.6*100 = 12.857`（点A score=85, need=70）。断言 `math.Abs(12.86-0)>1e-6` 必然触发 t.Errorf，测试一旦配置 TEST_DATABASE_URL 运行即红。实测验证：`go run` 确认 test=0 / service=12.857。最佳实践：改为 `((85.0-70)/70.0*0.6+0)*100` 或直接写期望值 12.857142857142856。顺带确认：同测试 wantV2=105、cognition=73 与实现一致，无误。

## backend/internal/handler/job_advanced_test.go

无问题（CreateBindingAndList/绑定知识/能力/等级映射/权重/订阅 CRUD 测试均覆盖到位，清理完整）。

## backend/internal/handler/job_banner_handler.go

- [P2][部分更新/数据丢失] job_banner_handler.go:64-92 — Update 为全字段覆盖：`ValidateUpdate` 仅要求 title/imageUrl，`SortOrder int`/`IsEnabled bool` 为非指针类型，PUT 省略时静默重置为 0/false；`LinkURL` 省略时清空。与 learn_roads/on_site 已建立"未传回填现有值"的约定不一致。最佳实践：改为指针字段并在 UpdateFn 内回填（同 learn_road_handler.go:83-99）。

## backend/internal/handler/job_handler_test.go

无问题（岗位/能力/域/批次/推荐/学习路径 CRUD 与 SaveFull 回归用例覆盖充分，含 2026-08-07 修复的能力点复用、空名跳过、publicAbilityId 传递回归断言）。

## backend/internal/handler/knowledge_point_handler.go

- [P2][部分更新/数据丢失] knowledge_point_handler.go:87-96 — UpdateFn 直接透传 `Code/Description/Linked/GranularLessonIds`；store Update（lesson_content.go:158-174）对 nil 的 granular_lesson_ids 写 `'{}'`、nil code/description 写 NULL、linked 写 false，并同步清空颗粒课引用（SyncCourseKnowledgePoints）。PUT 仅带 name（lesson_handler_test.go:221 即如此调用）会静默清空知识点关联数据，且现有测试未断言保护。最佳实践：与 learn_roads 一致，UpdateFn 内先 GetByID 回填未传指针字段。

## backend/internal/handler/landing_handler.go

- [P2][错误吞静默失败] landing_handler.go:44-48 — ListExams 的数据源 store/landing.go:69 `rows.Scan` 出错时 `continue`，扫描失败的行被静默丢弃，接口返回不完整数据且无任何错误信号。最佳实践：scan 失败直接返回 error（走 respondServerError）。
- [P3][边界] landing_handler.go:69-72 — `computeExamStatus`：startTime==nil 恒判"进行中"，若 endTime 已过但 startTime 为 NULL 的存量考试永远不显示"已结束"。

## backend/internal/handler/landing_handler_test.go

无问题（含跨租户岗位 E、draft 方案岗位 C 隔离断言，覆盖到位）。

## backend/internal/handler/learn_road_handler.go

无问题（部分更新回填实现正确，List 缺租户 403 处理正确）。

## backend/internal/handler/lesson_batch_test.go

无问题（UpdateWithStatus 分支覆盖有效）。

## backend/internal/handler/lesson_behavior_handler.go

- [P2][契约/一致性] lesson_behavior_handler.go:257-259、309-315、317-333 — `buildAggregate` 的 SignInDaily/AttendanceRateData/StudentDetails 均从 Go map 迭代生成，输出顺序随机：同一天签到曲线/出勤率图表/学生明细刷新即抖动。最佳实践：按日期/学生名排序后再输出（或按记录顺序维护有序 slice）。
- [P3][校验] lesson_behavior_handler.go:156-160 — Create 未校验 `Attendance` 枚举（present/late/absent 之外的值静默不计入聚合）与 `RecordDate` 格式（非法日期字符串直达 PG 报错 → 500，非 400）。

## backend/internal/handler/lesson_handler_test.go

- [P3][测试] lesson_handler_test.go:579-581 — `TestCourseBatch_CRUD` 为空测试（仅注释，无任何断言），无意义。最佳实践：删除或补充真实断言（lesson_batch_test.go 已覆盖该接口，可删）。

## backend/internal/handler/log_handler.go

无问题（缺租户 403、500 统一处理正确）。

## backend/internal/handler/major_handler.go

无问题（CreateTenantFn 用请求体 tenantId + verifyRequestTenant 双重校验；Update/Delete 经 CheckOwnership 归属校验；PermitGet 只读放开与路由层 businessUser 门禁一致）。

## backend/internal/handler/micro_cert_handler.go

- [P2][契约] micro_cert_handler.go:118-121、170-173 — 创建/更新模板只校验 `Title`/`CertTypeName`；`cert_type_id` 列为 `uuid NOT NULL`（001_baseline.up.sql:647），`certTypeId` 为空时 `normalizeCertTypeID("")` 返回 ""（micro_cert_handler.go:66-67），INSERT '' 直接 PG 报错 → 500。最佳实践：certTypeId 必填校验（400）或按 cert_type_name 生成确定性 UUID。
- [P3][契约] micro_cert_handler.go:248-251 — IssueCerts 中目标用户存在但不属于本租户时（store micro_cert.go:138-140 返回 fmt.Errorf），handler 归为 500；此类是客户端业务错误，应 400/403。

## backend/internal/handler/node_evaluation_result_handler.go

- [P3][校验] node_evaluation_result_handler.go:205-217 — Submit 未校验 `nodeId` 存在且属于当前租户，可写入引用他租户节点的脏行（所有读路径均按 tenant_id 过滤，无数据泄露，但产生孤儿数据）。
- [P3][校验] node_evaluation_result_handler.go:103-107 — Grade 未校验 Score 范围（负数/超 max_score 均可写入）；Submit 的 MaxScore 无上限约束。

## backend/internal/handler/node_homework_handler.go

- [P2][部分更新/数据丢失] node_homework_handler.go:83-90 — UpdateFn 直接透传 `Requirement/Deadline/NeedAttachment`；store Update（lesson_content.go:338-341）全列覆盖，ValidateUpdate 仅要求 title，故 PUT 省略 requirement/deadline 即被置 NULL、省略 needAttachment 即被置 false。最佳实践：与 learn_roads 一致回填现有值（crud 骨架已有 ValidateUpdateExisting 钩子可用）。

## backend/internal/handler/node_quiz_handler.go

- [P2][部分更新] node_quiz_handler.go:118-122 — UpdateQuiz 直接透传 `TimeLimit *int`，PUT 省略 timeLimit 即清空（node_quizzes.go:72-75 全列覆盖）。最佳实践：UpdateFn 内回填现有 timeLimit 或改用指针三态语义。
- [P3][契约] node_quiz_handler.go:104-107、141-144、164-167、201-204、241-244、281-284 — GetQuiz/GetQuizQuestion 返回**任何**错误（含 DB 故障）都响应 404，DB 错误被误报为"不存在"。

## backend/internal/handler/node_resource_handler.go

- [P2][错误吞静默失败] node_resource_handler.go:167-170 — UnbindResource 中 `BindTargetID` 返回**任何**错误（含 DB 错误）都响应 200 `{"id":...}`，解绑失败被静默吞掉。最佳实践：仅 `pgx.ErrNoRows`（绑定不存在）幂等返回 200，其余错误走 respondServerError。
- [P3][隔离] node_resource_handler.go:108-114、152-156 — Create/BindResource 未校验 node 租户归属（仅 Unbind 做了 node→course→tenant 链路校验），可对任意 node_id 写入绑定脏行；绑定时资源仍按 `rl.tenant_id` 过滤，无数据泄露，但跨租户节点被附加了不可见绑定。
- [P3][风格] node_resource_handler.go:33-35 — ListResources 未登录返回 401，与其余 handler 统一 403 的约定不一致。

## backend/internal/handler/on_site_question_library_handler.go

- [P3][风格/死代码] on_site_question_library_handler.go:157-174 — Get 手工复刻 crudGet 全流程（GetByIDFn+GetOwnership 校验+响应），与 crud.go:104-136 重复，且漏掉 AfterLoad 等骨架能力。最佳实践：直接复用 crudGet。
- [P3][契约] on_site_question_library_handler.go:64-154 — crud 未配 ValidateUpdate：空 body 的 PUT 全字段回填后产生一次无意义 no-op 更新，且无法通过"传空数组"清空 knowledgePointIds/tags（空切片被回填逻辑吞掉）。

## backend/internal/handler/on_site_question_library_handler_test.go

- [P3][测试] on_site_question_library_handler_test.go:15 — 注释"该资源无写路由，测试数据经 SQL 直接插入"已过时：routes_library.go:18-20 已注册 POST/PUT/DELETE，Create/Update/Delete handler 无任何测试覆盖。最佳实践：补充 CRUD 测试（尤其学生视角答案剥离与部分更新回填）。

---

## 通用骨架问题（影响本批多个 crud 系 handler）

- [P2][错误吞静默失败] crud.go:100、crud.go:187 — `item, _ := cfg.GetByIDFn(...)` 创建/更新后的**回读错误被吞掉**，DB 写成功但回读失败时返回 201/200 + 零值空实体，客户端拿到空对象且无错误提示。上轮"回读错误改 500"只覆盖了手写回读的 handler，crud 骨架（本批 banner/knowledge_point/learn_road/major/on_site/node_homework 均走此路径）是遗漏点。最佳实践：回读失败时 respondServerError（保持写已成功但响应 500 的语义，与其余 handler 一致）。

---

## 汇总

- 审查文件数：20
- 问题总数：22（P1×1、P2×10、P3×11；另含 1 条通用 crud.go 骨架问题计入 P2）

### P0/P1 摘要

**P0：无。**

**P1（1 条）：**
1. `job_ability_result_handler_test.go:91-94` — 回退胜任度期望值公式存在 Go 整型常量除法缺陷（`(85-70)/70`=0），实际实现计算 12.857，断言必然失败；测试配置测试库后即红，属于上轮新增的坏回归测试，须修正为 `((85.0-70)/70.0*0.6)*100`。
