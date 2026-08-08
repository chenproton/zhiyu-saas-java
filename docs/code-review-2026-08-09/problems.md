# 全量代码逐文件审查问题清单（2026-08-09）

> 配套勾选清单：`checklist.md`（876 文件：后端 355 + 前端 521）。
> 审查原则：① 简单优先，不过度防御；② 安全只排高危；③ 性能与稳定性优先；④ 容忍 hacker；⑤ 锁只给核心业务。
> **第二批回查任务**：所有条目待回查确认后补充精确代码位置与最佳实践方案（"回查确认"列）。

## 第一批已发现问题（2026-08-09 批次1）

### 后端高危（0）

未发现：无未鉴权接口、无 SQL 注入、无密钥泄露。

### 后端中危（约 30）

#### A. 同租户垂直越权（角色缺失）——5 项，最优先
| 位置 | 问题 | 回查确认 |
|------|------|----------|
| course_handler.go Grade/List 作业提交系列 | 学生可批改同学作业、查看全部学生作业提交 | 待回查 |
| micro_cert_handler.go IssueCerts | 任意登录用户可批量颁发证书 | 待回查 |
| graduation_handler.go ArchivesCRUD/EvaluationsCRUD | 创建档案/评价未校验 userID/topicID 租户归属，可串租户写入 | 待回查 |
| exam_result_handler.go List/Get | 学生可查看他人考试成绩（无 ownOnly） | 待回查 |
| evaluation_result_handler.go Grade/BatchGrade | 评分无角色校验，学生可伪造评分 | 待回查 |

#### B. 数据一致性
| 位置 | 问题 | 回查确认 |
|------|------|----------|
| approval_handler.go Get 等（TenantID==nil 跳过校验） | 无租户审批记录可被任意登录用户读取 | 待回查 |
| service/position.go SaveFull | prepare 预写入脱离事务，失败留孤儿数据（吞错已修，事务化未做） | 待回查 |
| service/evaluation_result.go + node_evaluation_result.go | 评分后考试分数回写跨事务、错误被吞、BatchGrade N+1 | 待回查 |
| course_import_handler.go | findOrCreate 事务外写 + clearCourseNodes 吞错 | 待回查 |
| granular_course_import_handler.go | 导入无事务 + replaceCourseBindings 吞错 | 待回查 |
| position_import_handler.go | overwrite 清空重写无事务 + 全部 Exec 吞错 | 待回查 |
| schedule_import_handler.go L360/644 | 教学计划条目 scheduled 状态同步错误被吞 | 待回查 |
| subscription_handler.go AdminUpdate | 查询失败未区分 NotFound 与 DB 错误，DB 故障时重复建订阅 | 待回查 |
| teaching_plan_handler.go L119 | FetchPositionScenarios 错误被吞，生成结果不完整无提示 | 待回查 |
| tenant_handler.go L641 / training_program_handler.go L318 | 回读错误忽略返回空对象 | 待回查 |
| question_handler.go BatchCreate | 批量创建未校验 item 必填字段 | 待回查 |
| auth_handler.go 重放防护 | usedNonces check-then-set 非原子 + 登录 N 次 bcrypt | 待回查 |

#### C. store 层（scan 丢 rows.Err 10 处 + 统计吞错 + 非原子计数）
| 位置 | 问题 | 回查确认 |
|------|------|----------|
| evaluation_methods/exam_results/exams/graduations/resource_bindings 等 Scan 函数 | `return items, nil` 丢 rows.Err()，迭代错误被吞（约 10 处） | 待回查 |
| portal.go 统计查询 9+ 处 | `_ = QueryRow.Scan` 吞错，DB 故障显示 0 | 待回查 |
| favorites.go/positions.go ToggleFavorite | 收藏计数非原子（counter 与收藏表可能漂移） | 待回查 |
| courses.go ReplaceCourseBindings/SyncKnowledgePointGranularLessons | 多语句无事务 | 待回查 |
| course_assessments.go CleanupCourseLevelAssessments | DELETE 错误仅 Warn 且返回 nil | 待回查 |
| exam_results.go Grade / FetchUserProfile | RowsAffected 未检查 / 查询吞错 | 待回查 |
| position_certificates.go List | store 层无租户过滤（不传 careerPositionID 返回全库） | 待回查 |
| resource_bindings.go Bind/Unbind | afterBind/afterUnbind 吞错，绑定表与 resource_ids 漂移 | 待回查 |
| auth.go 多处 | GetTenantByID 等返回 nil 不返回错误；scan continue 吞行 | 待回查 |

#### D. 基础设施
| 位置 | 问题 | 回查确认 |
|------|------|----------|
| cmd/migrate/main.go isMultiStatement | `;\n` 计数误判单语句为多语句，走非事务执行 | 待回查 |
| scheduler/scheduler.go | 每日汇聚任务无分布式锁，多实例重复执行 | 待回查 |
| middleware/rbac.go | 菜单权限是 JWT 快照，角色变更后最长 7 天不生效 | 待回查 |
| service/job_ability_aggregator.go | 每学生一事务 + 进程内锁多实例无效 + 崩溃留 running 日志 | 待回查 |
| service/community.go GetTopic | RecordView 计数失败拖垮详情接口返回 500 | 待回查 |

### 后端低危（约 60）
- 导入类 handler 大量 Exec 错误吞（冻结区，标注即可）：position_import/schedule_import/granular_course_import/import_export
- DB 错误误报 404：course_handler/exam_usage_handler/graduation_handler/on_site_question_library/crud.go 多处
- RowsAffected 未检查：abilities/banners/content_actions/approvals
- 非原子 check-then-insert：CreateTempExam/findOrCreateLibrary/EnsureDraftPool/entity_code
- 性能：courses/positions/community/landing 列表相关子查询、affairs AutoSchedule 逐条 INSERT
- auth_handler rand.Read 错误忽略、question_bank isDraftPool 失败放行、batch_handler 重名 500、settings/tenant Admin 无 handler 级鉴权（依赖路由层）、student_portrait context.Background、logs.go 占位、position_certificates 风格、micro_cert GetTemplate 非指针、positions `_ = name`、graduations 字符串比较错误、exam_usages 读路径全表 UPDATE、template_handler 重复查询、workflow CreateTenantFn 无租户放行、domain JSONMap default 分支静默、router CORS 全开、cache writer 无 Flusher、user_management BatchCreate 无上限

### 前端中危（17）
| 位置 | 问题 | 回查确认 |
|------|------|----------|
| evaluation/exams/[id] | 增删题目/排序/分数/发布 5 处 fire-and-forget 无 await 无提示 | 待回查 |
| evaluation/exam-usage/page | loadUsages 无 catch，失败停留 loading | 待回查 |
| evaluation/lesson-results/daily-exams | 每安排一次 list N+1 最高 500 并发 | 待回查 |
| evaluation/landing/banks/[id] | limit 10000 + as any 全量渲染 | 待回查 |
| evaluation/scene-results/[id] | limit 9999 魔数 + 用户表 limit 1000 截断 | 待回查 |
| evaluation/scene-results/page | taskApi limit 10000 | 待回查 |
| scheduling/page | 伪造 AffairsTerm 对象 as any 传 TimetableViewTab | 待回查 |
| programs/page createPayload | t('本科') 翻译数据值，切英文产生脏数据 | 待回查 |
| programs/[id]/courses-tab | 岗位场景串行 N+1 + catch 全吞 | 待回查 |
| evaluation/job-ability/page | 每条规则 N+1 getPositionModel | 待回查 |
| lesson-results/[id] | 全量用户表查学生名 >1000 截断 | 待回查 |
| landing/exams/[id] | usage URL 参数变化不切换考试安排 | 待回查 |
| question-banks/[id] | 批量删除串行中断 + moveQuestions fire-and-forget | 待回查 |
| schedule-grid-tab | limit 200 前端过滤不全（已有 TODO） | 待回查 |

### 前端低危（37）
- any 滥用约 15 处（history:any/mapRecord(a:any)/props:any 等）
- 静默吞错约 10 处（courses-tab catch{}、landing catch{}、exam-center catch 等）
- 硬编码状态字符串 6 处（draft/published 数组）
- dead code：savingQuick/setLoadingPlan 2 处
- 空操作按钮 2 处（results 详情按钮/导出占位）
- i18n：level-config-dialog 动态 key 翻译无法命中
- O(n²)：approvals includes 查找

## 第二批检查记录（进行中）

## 第二批已发现问题（2026-08-09 批次2）

### 后端中危（约 18）
- hybrid_module_handler.go BatchSave：未校验节点存在性与租户归属（对比 UpsertModule 有校验，行为不一致），可写孤儿模块行
- node_resource_handler.go Create/Bind：未校验目标节点租户归属（对比 Unbind 有完整校验链）
- ability_domain_handler.go：Create/Update 未校验 CareerPositionID 归属；Update 无 ValidateUpdateExisting 部分更新兜底（PUT 置空清库）
- recommend_handler.go CreateFn：未校验岗位租户归属
- favorites_handler.go：FavoriteCount 错误被吞，前端显示 0
- appeal_handler.go Process：handler 无角色校验（路由层 businessUser 组兜底，无纵深）
- course_clone/position_clone：scan 错误 continue 静默跳过，克隆时绑定/证书无声丢失
- cert_grades.go：ListCompRequirements/ListLeaderboard scan 错误静默跳过
- alliance_enterprise_store.go GetPublicStats：5 个 QueryRow 吞错，DB 故障前台显示全 0
- organizations.go MemberCounts：tenantID 为空时统计全库用户（对比 Tree 有 1=0 兜底）
- dict_store.go 基类 GetByID/Update/Delete 无租户过滤（OrgTypes/Majors 嵌入方未覆写）
- 一批按 id 单参无租户的 store 方法（course_clone/position_clone/node_evaluation_results/organizations/position_bindings）——系统性纵深风险
- exam_questions.go SyncExamQuestions / hybrid_modules.go ReplaceByNode：多语句但不保证事务（依赖调用方传 tx）
- cmd/seed/main.go：Scan 吞错，DB 异常时误走重建分支
- 冻结区标注：exam_import DELETE 无租户条件、scenario_import overwrite 吞错、resource_import user_roles 吞错、question_bank_import 无事务、question_import 题型无法识别静默转 single

### 前端中危（约 22）
- portal/apps/alliance/projects/page.tsx onToggleEnabled：只回传 { isPublic } 局部对象（同仓 achievements 页全量回传），后端全列覆盖 PUT 会清空项目字段——**保存即丢数据**
- portal/apps/alliance/school/page.tsx：城市回填校验写死北京区县（CHINA_REGION[PROVINCES[0]]），非北京学校编辑保存会覆盖 city
- portal/apps/system/org-user/org-structure：批量毕业 limit 1000 拉取截断
- job/landing/[id]/page.tsx：Promise.all 5 接口 setState 无序号检查（同文件 L142 有守卫但此处没有）
- job/landing/[id]/learn/page.tsx：场景/任务加载链无取消守卫
- library/my-resources：4 类列表 limit 200 截断（有 TODO 与兜底提示）
- library/questions/page.tsx：limit 9999 魔数
- system/add/page.tsx：本地资源上传绑定失败仅 reportError 继续，节点保存成功但资源静默缺失（hybrid/granular 版均上抛，不一致）
- job/positions/[id]/edit：3 个 setter 只赋值从不读取（死代码）
- granular/add：3 个死 state
- hybrid/add + system/add：各 1400+ 行单组件
- job-home.tsx 场景×任务 N+1 请求风暴
- bank-question-selector-panel：any 滥用 + 双重断言 + 逐题 N+1
- auth-provider.tsx fetchMe 无请求序号守卫
- manual-question-dialog 无 catch（unhandled rejection + loading 残留）
- hybrid-modules-view homework 项名称被固定文案替换
- evaluation-rules-editor：中文作 tab 值（'全部' 与专业 id 碰撞风险）+ peerRule 中文作持久化值 + (config as any)[field]
- content-list-page 克隆名硬编码中文写入 DB；knowledge-selector 同
- image-list-upload 上传失败静默降级 blob URL（脏数据入库）
- question-grading-card 判断题答案归一硬编码中文 '正确'
- use-resource-maps 无缓存无取消标志，6+ 页面重复全量请求行业/专业
- use-approvals 工作流 limit 1000 宽拉取
- shared-types 多处 Date 类型与后端 string 不符（evaluation-exam/certificate-issuance/evaluation-scene/portrait/lesson-source）
- scene/landing/[id]/learn：resourceLibraryApi limit 10000
- scene/landing/[id]：4 接口 limit 200 截断（代码 TODO 自认）+ ATTRIBUTE_COLORS 中文作数据键
- tasks/page.tsx：能力点详情弹窗死代码（从不置 true）+ persistWeights 错误被吞仍 toast 保存成功 + requiredLevelColors/domainIconMap 中文作数据键 + 2504 行
- superadmin/page.tsx：atob 解码 JWT base64url 错误（-/_ 字符丢失）
- task-description-card 富文本工具栏 22 按钮全部无 onClick
- use-task-datasets：加载前即标记已加载，失败后永久无法重试
- scene/archive confirmBatchDelete Promise.all 部分失败无明细

## 第三批已发现问题（2026-08-09 批次3）

### 测试体系问题（严重级：高）
- testhelper/setup.go：TEST_DATABASE_URL 未配置时整包静默跳过（CI 假绿无提示）
- setup.go ensureSeedData DELETE 清单不完整（20+ 表不在清单），共享 TestTenantID 跨文件污染
- setup.go Cleanup 只 Close 不清理数据，测试库累积脏数据
- evaluation_handler_test.go L785/L1288：batch-grade 断言"非 200 即通过"（500 也通过，恒过断言）
- lesson_handler_test.go TestCourseBatch_CRUD 空函数体（恒通过占位）
- settings_handler_test.go 修改平台主题后不还原（全局状态污染）
- portal_learning_test/teaching_plan_generate_classes_test：清理手动执行非 defer，且按租户全量 DELETE 误删他测试数据
- alliance_import_test 开头 DELETE 共享租户全部 alliance 数据
- 覆盖盲区：导入冻结区外大量导入分支无测试、导出 HTTP 接口无测试、权限矩阵无测试、事务回滚无测试

### 前端第三批低危（约 30）
- superadmin/page.tsx：fetchThemeColor 无 catch、租户列表无分页控件、套餐加载无竞态守卫
- scene/page.tsx generateCode Math.random 可能重复、V1.0 与 v1.0 大小写不一致
- task-description-card iframe 无 sandbox、includes('<img') 误报
- tasks-logic.tsx 多处 Record<string,any>、defaultGradeMapping remark 中文
- repro.test.ts 残留 console.log
- vitest.config.ts alias 重复定义
- landing/[id]/learn 硬编码 'h' 课时单位
- scene/approvals history any、professionNames 混用
- task-info-card 空输入变 0、负数未拦截

## 全部检查完成（876/876）

## 回查阶段结果（2026-08-09 已全部回查确认）

### 回查统计：77 条中危问题 → 确认存在 72 条 / 已修复 4 条 / 不存在 1 条

### A. 后端同租户垂直越权（11 条，全部确认存在）
| # | 位置 | 确认结果与方案 |
|---|------|----------------|
| 1 | course_handler.go:484-524/602-642 + rbac.go:56 | 存在：学生可 GET 查看全部作业提交（含内容/分数/附件）——rbac 菜单豁免 + handler 无 ownOnly。方案：GET 加角色校验；store 加 studentID 参数 |
| 2 | micro_cert_handler.go:224-254 | 部分存在：全部业务角色可批量颁发证书（store 已拦跨租户用户）。方案：加 canManagePortal |
| 3 | graduation_handler.go:266-331 | 存在：CreateArchive/CreateEvaluation 未校验 topic/user 租户归属。方案：INSERT...SELECT WHERE EXISTS 原子校验 |
| 4 | exam_result_handler.go:25-53/118-138 | 存在：学生可查看他人考试成绩（对比 evaluation_result_handler 有 ownOnly）。方案：学生强制 userId=本人 + Get 校验 |
| 5 | evaluation_result_handler.go:188-275 | 部分存在：企业导师等可给任意学生评分（路由 businessUser 兜底学生）。方案：加 canManagePortal |
| 6 | appeal_handler.go:107-145 | 存在：handler 无角色校验。方案：加 canManagePortal 或处理人校验 |
| 7 | approval_handler.go:81 | 存在：TenantID==nil 时跳过租户校验。方案：fail-closed 403 |
| 8 | hybrid_module_handler.go:114-144 | 存在：BatchSave 无节点归属校验（对比 UpsertModule:62-65 有）。方案：前置 CourseNodes().Get 校验 |
| 9 | node_resource_handler.go:82-158 | 存在：Create/Bind 无节点/资源归属校验（对比 Unbind:160-190 有完整链）。方案：复用校验链 |
| 10 | ability_domain_handler.go:72-94 | 存在：Create/Update 未校验岗位归属 + 无部分更新兜底。方案：校验岗位租户 + 指针化字段 |
| 11 | recommend_handler.go:69-78 | 存在：CreateFn 未校验岗位租户。方案：Get 校验 |

### B. 后端数据一致性（35 条：32 存在 / 2 已修复 / 1 不存在）
已修复：courses.go ReplaceCourseBindings（调用方已包事务）、SyncExamQuestions（调用点在 WithTx 内）、resource_bindings.go:237 rows.Err
不存在：certification_model_handler GetModel（岗位不存在返回 200 空模型，正常行为）
确认存在（按影响排序）：
- scan 丢 rows.Err 9 处：evaluation_methods:113/206、evaluation_results:355、exam_results:480、exams:272/295、graduations:371/385/405、organizations:278、course_nodes:396、training_programs:224、user_relations:102
- portal.go:64/80/103/157/261/282/299/307/703 统计吞错 10 处
- favorites.go:79-117 / positions.go:499-534 ToggleFavorite 非原子
- course_assessments.go:202-218 清理吞错返回 nil
- exam_results.go:83-92 Grade 无 RowsAffected；:264-275 FetchUserProfile 吞错
- resource_bindings.go:154/171 afterBind/afterUnbind 吞错
- course_clone.go/position_clone.go scan continue 静默丢行
- cert_grades.go:88-90/124-126 scan 静默跳过
- alliance_enterprise_store.go:377-385 GetPublicStats 吞错
- organizations.go:75-99 MemberCounts 空租户统计全库
- dict_store.go:56-85 基类无租户过滤
- service/position.go:100-114 SaveFull prepare 仍在事务外（错误传播已修）
- evaluation_result.go:255-301 评分回写跨事务 + BatchGrade 2N 查询
- cmd/migrate/main.go:221-226 多语句判定误判（57 个迁移文件受影响）
- scheduler.go:21-35 无分布式锁
- job_ability_aggregator.go:228/379 每学生一事务 + 进程内锁
- community.go:60-62 RecordView 失败拖垮详情
- subscription_handler.go:115-126 错误分支混淆
- teaching_plan_handler.go:119 场景查询吞错
- tenant_handler.go:641 / training_program_handler.go:318 回读忽略
- question_handler.go:250-267 BatchCreate 无必填校验
- portal.go:218-223/553-558 读路径全表 UPDATE
- position_certificates.go:23-66 List 无租户（handler 兜底）
- favorites_handler.go:47 / position_handler.go:519/540 FavoriteCount 吞错
- course_import_handler.go:410/419/502-506 findOrCreate 事务外 + 吞错（冻结区）
- granular_course_import_handler.go:221-240 replaceCourseBindings 吞错（冻结区）
- position_import_handler.go:147-150 overwrite 无事务（冻结区）
- schedule_import_handler.go:360/644 scheduled 状态吞错（冻结区）
- node_evaluation_result.go:35-60 评分回写跨事务
- affairs.go:313-317 AutoSchedule 逐条 INSERT
- lesson_content.go:390-418 发布钩子长事务

### C. 前端（31 条：29 存在 / 2 已修复）
已修复：alliance/projects onToggleEnabled（后端 ValidateUpdateExisting 兜底 + 测试）、my-resources 截断（有提示条）
确认存在（高优先）：
- image-list-upload:50-55/198-202 上传失败静默降级 blob URL（脏数据入库）
- system/add:712-727 资源绑定失败无感知
- tasks/page.tsx:661-676 persistWeights 失败仍 toast 保存成功
- superadmin/page.tsx:261/286 atob 解码 base64url 错误（可致管理员登出）
- exams/[id]:216-315 5 处 fire-and-forget
- question-banks/[id]:397-401 moveQuestions fire-and-forget
- hybrid-modules-view:422-426 作业名被固定文案替换
- content-list-page:781/920 + knowledge-selector:299 克隆名硬编码中文写 DB
- programs/page:48-56 t('本科') 作数据值
- school/page:157 城市回填写死北京
- org-structure:480-485 批量毕业 limit 1000 截断
- job/landing/[id]:154-171 Promise.all 无序号守卫
- job/landing/[id]/learn:49-90 无取消守卫
- auth-provider:65-93 fetchMe 无序号守卫
- manual-question-dialog:72-83 无 catch
- bank-question-selector-panel:97-122 逐题 N+1
- evaluation-rules-editor:388/554/4004 中文作 tab/数据值
- question-grading-card:41-46 判断题中文归一
- use-resource-maps 无缓存无取消
- shared-types Date 与后端 string 不符（6 文件）
- scene/landing/[id]/learn:155 limit 10000
- scene/landing/[id]:398 limit 200 截断（TODO 自认）
- tasks/page.tsx:1659-1660 能力点弹窗死代码
- task-description-card:42-80 富文本工具栏 21 按钮无功能
- use-task-datasets:157-159 失败后不可重试
- scene/archive:107-122 Promise.all 部分失败无明细
- scheduling/page:175-185 伪造 term 对象
- exam-usage/page:100-108 无 catch
- daily-exams:48-68 N+1 并发

### D. 测试体系（7 条严重）
- testhelper/setup.go:52 TEST_DATABASE_URL 未配置整包静默跳过（CI 假绿）
- setup.go ensureSeedData DELETE 清单不完整（20+ 表缺失）+ Cleanup 不清理数据
- evaluation_handler_test.go:785/1288 恒过断言（非 200 即通过）
- lesson_handler_test.go TestCourseBatch_CRUD 空函数体
- settings_handler_test.go 修改平台主题不还原
- portal_learning/teaching_plan_generate_classes 清理非 defer + 按租户全量误删
- 覆盖盲区：导入/导出/权限矩阵/事务回滚无测试

### E. 低危问题（约 130 条）
见各批次记录：any 滥用 ~30 处、静默吞错 ~25 处、硬编码状态字符串 ~15 处、死代码 ~8 处、性能（N+1/相关子查询/逐条 INSERT）~12 处、i18n 缺失 ~10 处、冻结区标注 ~15 处、风格 ~15 处。按"简单优先"原则均可不修或随迭代处理。

## 总结
- 高危：0（无未鉴权接口、无 SQL 注入、无密钥泄露、无 XSS）
- 中危：72 条确认存在（后端越权 11 + 后端数据一致 32 + 前端 29）
- 已修复 4 条 + 不存在 1 条（回查中确认）
- 低危：约 130 条（可容忍）
- 最大风险排序：① 学生查看他人成绩/作业（越权×2）② 评分/回写一致性 ③ 迁移无事务 ④ 测试假绿 ⑤ 前端 fire-and-forget 假成功
