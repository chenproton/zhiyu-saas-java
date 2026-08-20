# 技术栈迁移接口对齐核对报告 —— job 招聘/岗位域

> 核对范围：Go 端 `backend/go/internal/router/routes_job.go` 及 job 域相关 handler（position_*、ability、landing、learn_road、recommend、industry、major、certificate_library、staff_title、on_site_question_library、snapshot、user_extension_field、random_draw_question、job_ability_result 等）；
> Java 端 `backend/java/ruoyi-modules/ruoyi-zhiyu/.../controller/job/` 全部 Controller，及域内 handler 落在其他目录的对应 Controller（system / library / evaluation / importexport）。
>
> 路径前提：Go 端所有业务路由挂在 `/api/v1` 前缀下（routes.go:18），Java 端 Controller 同样使用 `/api/v1` 前缀，因此两侧路径**字面基本一致**，核对重点在功能/行为等价性。
>
> 状态图例：✅ 已对齐 ｜ ⚠️ 部分对齐（有差异，见说明）｜ ❌ 缺失 ｜ ➕ Java 新增

## 统计摘要

| 状态 | 数量 |
|---|---|
| ✅ 已对齐 | 128 |
| ⚠️ 部分对齐 | 1 |
| ❌ 缺失 | 0 |
| ➕ Java 新增 | 0 |
| **Go 端接口总数** | **129** |

**结论：job 域对齐度极高（129/129 有对应实现）。Java 端是刻意的 1:1 移植（控制器注释均写明"对齐 Go xxx，前端契约零改动"），路径、过滤参数、默认分页（limit=50）、默认排除 archived 等细节均一致。唯一 ⚠️ 为 save-full 响应包装差异。**

---

## 一、岗位 positions（Go routes_job.go:6-8 + routes.go:154-156/257-258/270）

Go 路由来源：`registerContentRoutes(r, "/job/positions", ...)`（router.go:36-50 展开为 13 个端点）+ clone/save-full + 收藏组 + public 组 + snapshot。
Java 对应：`JobPositionController.java`（/api/v1/job/positions）+ `JobPublicPositionController.java`（/api/v1/job/public/positions）。

| # | Go 接口 | 功能 | 状态 | Java 对应 | 说明 |
|---|---|---|---|---|---|
| 1 | GET /job/positions | 管理端岗位列表（search/status/batchId/positionType 过滤，默认排除 archived，limit=50） | ✅ | JobPositionController.java:41 | 过滤参数与默认值一致（对照 store/positions.go:38-66 AdminListConfig 与 Java list() 注释及参数） |
| 2 | GET /job/positions/{id} | 岗位详情（异步记录浏览量） | ✅ | JobPositionController.java:53 | 两侧均记录 view（Go position_handler.go:79；Java 注释"记录浏览量"） |
| 3 | POST /job/positions | 创建岗位（draft） | ✅ | JobPositionController.java:59 | |
| 4 | PUT /job/positions/{id} | 更新岗位（部分更新） | ✅ | JobPositionController.java:65 | |
| 5 | DELETE /job/positions/{id} | 删除岗位 | ✅ | JobPositionController.java:71 | |
| 6 | POST /job/positions/{id}/submit | 提交审核 | ✅ | JobPositionController.java:77 | |
| 7 | POST /job/positions/{id}/review | 审核（approved/rejected） | ✅ | JobPositionController.java:83 | |
| 8 | POST /job/positions/{id}/publish | 发布 | ✅ | JobPositionController.java:89 | |
| 9 | POST /job/positions/{id}/archive | 归档 | ✅ | JobPositionController.java:95 | |
| 10 | POST /job/positions/{id}/unpublish | 取消发布 | ✅ | JobPositionController.java:101 | |
| 11 | POST /job/positions/{id}/withdraw | 撤回（删待审批记录） | ✅ | JobPositionController.java:107 | |
| 12 | POST /job/positions/{id}/save-draft | 存草稿 | ✅ | JobPositionController.java:113 | |
| 13 | POST /job/positions/{id}/invite | 邀请协作者 | ✅ | JobPositionController.java:119 | |
| 14 | POST /job/positions/{id}/clone | 克隆岗位（含全部关联，状态重置 draft，409 名称冲突） | ✅ | JobPositionController.java:125 | Go position_clone_handler.go:24-60；Java JobPositionServiceImpl.java:402，语义一致 |
| 15 | PUT /job/positions/{id}/save-full | 岗位构建器全量保存（职责/能力绑定/能力域/证书/专业全量重写，同事务预写能力点/证书库条目） | ⚠️ | JobPositionController.java:131 | **响应包装差异**：Go 返回裸 CareerPosition（position_handler.go:506 `respondJSON(w, ..., pos)`）；Java 返回 `{"position": dto}`（JobPositionController.java:134）。写语义两侧一致（Java JobPositionServiceImpl.java:268-327 与 Go SaveFull 均为全量重写）。注意：React api-client（frontend/packages/api-client/src/api/job.ts:73）与 Vue portal（frontend/portal-vue job.ts:27）声明的返回类型都是 `{position: CareerPosition}`——Java 与前端契约一致，反而是 Go 裸返回与 React 声明不符（React 页面未消费返回值故未暴露问题） |
| 16 | GET /job/positions/{id}/favorite | 查询收藏状态 | ✅ | JobPositionController.java:138 | |
| 17 | POST /job/positions/{id}/favorite | 切换收藏 | ✅ | JobPositionController.java:144 | |
| 18 | GET /job/positions/favorites | 当前用户收藏岗位列表（仅已发布） | ✅ | JobPositionController.java:150 | |
| 19 | GET /job/public/positions | 前台公开岗位列表（仅 published） | ✅ | JobPublicPositionController.java:28 | 功能等价。非功能性差异备注：Go 挂租户级 2min 缓存中间件 `cachedPublicPositions`（routes.go:257），Java publicList（JobPositionServiceImpl.java:134）未见缓存，时效性/性能特征略有差异 |
| 20 | GET /job/public/positions/{id} | 前台公开岗位详情 | ✅ | JobPublicPositionController.java:38 | |
| 21 | GET /job/positions/{id}/snapshot | 岗位快照 bundle（?version= 可选） | ✅ | JobPositionController.java:157 | |

### 岗位导入/导出/模板（Go routes.go:412-413/446/464）

| # | Go 接口 | 功能 | 状态 | Java 对应 | 说明 |
|---|---|---|---|---|---|
| 22 | POST /import/positions/excel | 岗位 Excel 导入落库 | ✅ | ImportExportController.java:83（/import/{entity}/excel，positions 受支持：ImportExportServiceImpl.java:79/158） | |
| 23 | POST /import/positions/preview | 岗位 Excel 导入预览 | ✅ | ImportExportController.java:70（/import/{entity}/preview） | |
| 24 | POST /export/positions/excel | 岗位 Excel 导出（按 ids） | ✅ | ImportExportController.java:126（/export/{entity}/excel，"缺少岗位ID"校验 ImportExportServiceImpl.java:458） | |
| 25 | GET /templates/positions | 岗位导入模板下载 | ✅ | ImportExportController.java:45（/templates/{entity}，"岗位批量导入模板.xlsx" case 于 :154） | |

## 二、能力点 abilities（Go routes_job.go:13-15 + routes.go:176-177/261-262）

| # | Go 接口 | 功能 | 状态 | Java 对应 |
|---|---|---|---|---|
| 26 | GET /job/abilities | 能力点列表 | ✅ | JobAbilityController.java:37 |
| 27 | GET /job/abilities/{id} | 能力点详情 | ✅ | JobAbilityController.java:48 |
| 28 | POST /job/abilities | 新建能力点 | ✅ | JobAbilityController.java:54 |
| 29 | PUT /job/abilities/{id} | 更新能力点 | ✅ | JobAbilityController.java:60 |
| 30 | DELETE /job/abilities/{id} | 删除能力点 | ✅ | JobAbilityController.java:66 |
| 31 | GET /job/abilities/citation-stats | 引用统计 | ✅ | JobAbilityController.java:72 |
| 32 | GET /job/abilities/uncited | 未被引用列表 | ✅ | JobAbilityController.java:78 |

## 三、岗位-能力绑定 position-abilities（Go routes_job.go:17-20 + routes.go:265）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 33 | GET /job/position-abilities（ListBindings） | ✅ | JobPositionAbilityController.java:35 |
| 34 | POST /job/position-abilities（CreateBinding） | ✅ | JobPositionAbilityController.java:45 |
| 35 | PUT /job/position-abilities/{id}（UpdateBinding） | ✅ | JobPositionAbilityController.java:51 |
| 36 | DELETE /job/position-abilities/{id}（DeleteBinding） | ✅ | JobPositionAbilityController.java:57 |

## 四、岗位职责 position-responsibilities（Go routes_job.go:22-26 + routes.go:263-264）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 37 | GET /job/position-responsibilities | ✅ | JobPositionResponsibilityController.java:35 |
| 38 | GET /job/position-responsibilities/{id} | ✅ | JobPositionResponsibilityController.java:44 |
| 39 | POST /job/position-responsibilities | ✅ | JobPositionResponsibilityController.java:50 |
| 40 | PUT /job/position-responsibilities/{id} | ✅ | JobPositionResponsibilityController.java:56 |
| 41 | DELETE /job/position-responsibilities/{id} | ✅ | JobPositionResponsibilityController.java:62 |

## 五、岗位证书绑定 position-certificates（Go routes_job.go:28-32 + routes.go:268-269）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 42 | GET /job/position-certificates | ✅ | JobPositionCertificateController.java:35 |
| 43 | GET /job/position-certificates/{id} | ✅ | JobPositionCertificateController.java:44 |
| 44 | POST /job/position-certificates | ✅ | JobPositionCertificateController.java:50 |
| 45 | PUT /job/position-certificates/{id} | ✅ | JobPositionCertificateController.java:56 |
| 46 | DELETE /job/position-certificates/{id} | ✅ | JobPositionCertificateController.java:62 |

## 六、证书库 certificate-library（Go routes_job.go:34-40）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 47 | GET /job/certificate-library | ✅ | JobCertificateLibraryController.java:37 |
| 48 | GET /job/certificate-library/citation-stats | ✅ | JobCertificateLibraryController.java:71 |
| 49 | GET /job/certificate-library/uncited | ✅ | JobCertificateLibraryController.java:77 |
| 50 | GET /job/certificate-library/{id} | ✅ | JobCertificateLibraryController.java:47 |
| 51 | POST /job/certificate-library | ✅ | JobCertificateLibraryController.java:53 |
| 52 | PUT /job/certificate-library/{id} | ✅ | JobCertificateLibraryController.java:59 |
| 53 | DELETE /job/certificate-library/{id} | ✅ | JobCertificateLibraryController.java:65 |

## 七、能力域 ability-domains（Go routes_job.go:42-46 + routes.go:266-267）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 54 | GET /job/ability-domains | ✅ | JobAbilityDomainController.java:35 |
| 55 | GET /job/ability-domains/{id} | ✅ | JobAbilityDomainController.java:44 |
| 56 | POST /job/ability-domains | ✅ | JobAbilityDomainController.java:50 |
| 57 | PUT /job/ability-domains/{id} | ✅ | JobAbilityDomainController.java:56 |
| 58 | DELETE /job/ability-domains/{id} | ✅ | JobAbilityDomainController.java:62 |

## 八、岗位批次 job/batches（Go routes_job.go:48，registerBatchRoutes 展开 router.go:87-94）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 59 | GET /job/batches | ✅ | JobBatchController.java:37 |
| 60 | GET /job/batches/{id} | ✅ | JobBatchController.java:48 |
| 61 | POST /job/batches | ✅ | JobBatchController.java:54 |
| 62 | PUT /job/batches/{id} | ✅ | JobBatchController.java:60 |
| 63 | DELETE /job/batches/{id} | ✅ | JobBatchController.java:66 |
| 64 | POST /job/batches/{id}/status | ✅ | JobBatchController.java:72 |

## 九、推荐位 recommendations（Go routes_job.go:50-53）

| # | Go 接口 | 状态 | Java 对应 | 说明 |
|---|---|---|---|---|
| 65 | GET /job/recommendations | ✅ | JobRecommendController.java:35 | 两侧均无 GET /{id}，形状一致 |
| 66 | POST /job/recommendations | ✅ | JobRecommendController.java:45 | Go 创建前校验岗位归属本租户（recommend_handler.go:69-75） |
| 67 | PUT /job/recommendations/{id} | ✅ | JobRecommendController.java:51 | |
| 68 | DELETE /job/recommendations/{id} | ✅ | JobRecommendController.java:57 | |

## 十、学习路径 learn-roads（Go routes_job.go:55-59）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 69 | GET /job/learn-roads | ✅ | JobLearnRoadController.java:35 |
| 70 | GET /job/learn-roads/{id} | ✅ | JobLearnRoadController.java:43 |
| 71 | POST /job/learn-roads | ✅ | JobLearnRoadController.java:49 |
| 72 | PUT /job/learn-roads/{id} | ✅ | JobLearnRoadController.java:55 |
| 73 | DELETE /job/learn-roads/{id} | ✅ | JobLearnRoadController.java:61 |

## 十一、Banner（Go routes_job.go:61-65）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 74 | GET /job/banners | ✅ | JobBannerController.java:35 |
| 75 | GET /job/banners/{id} | ✅ | JobBannerController.java:43 |
| 76 | POST /job/banners | ✅ | JobBannerController.java:49 |
| 77 | PUT /job/banners/{id} | ✅ | JobBannerController.java:55 |
| 78 | DELETE /job/banners/{id} | ✅ | JobBannerController.java:61 |

## 十二、落地页 landing（Go routes.go:475-477 registerLandingRoutes）

| # | Go 接口 | 功能 | 状态 | Java 对应 | 说明 |
|---|---|---|---|---|---|
| 79 | GET /job/landing/target-positions | 当前学生目标岗位（来源：人培方案按班级排的岗位） | ✅ | JobLandingController.java:28 → JobPositionServiceImpl.listTargetPositions():717 | 数据来源注释两侧一致（landing_handler.go:15 vs JobLandingController.java:15） |

## 十三、专业 majors（Go routes.go:239-240 只读 + 651-653 写）

| # | Go 接口 | 状态 | Java 对应 | 说明 |
|---|---|---|---|---|
| 80 | GET /majors | ✅ | system/MajorController.java:34 | Java 落在 controller/system 目录，路径相同 |
| 81 | GET /majors/{id} | ✅ | system/MajorController.java:42 | |
| 82 | POST /majors | ✅ | system/MajorController.java:47 | |
| 83 | PUT /majors/{id} | ✅ | system/MajorController.java:52 | |
| 84 | DELETE /majors/{id} | ✅ | system/MajorController.java:57 | |
| 85 | POST /import/majors/excel + POST /import/majors/preview | ✅ | ImportExportController.java:83/70（"majors" 模板 case ImportExportServiceImpl.java:166） | Go routes.go:428-429 |

## 十四、行业 industries（Go routes.go:241-242 只读 + 655-657 写）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 86 | GET /industries | ✅ | system/IndustryController.java:34 |
| 87 | GET /industries/{id} | ✅ | system/IndustryController.java:43 |
| 88 | POST /industries | ✅ | system/IndustryController.java:48 |
| 89 | PUT /industries/{id} | ✅ | system/IndustryController.java:53 |
| 90 | DELETE /industries/{id} | ✅ | system/IndustryController.java:58 |
| 91 | POST /import/industries/excel + POST /import/industries/preview | ✅ | ImportExportController.java:83/70（"industries" case ImportExportServiceImpl.java:165）；Go routes.go:426-427 |

## 十五、职称 staff-titles（Go routes.go:624-631）

| # | Go 接口 | 状态 | Java 对应 | 说明 |
|---|---|---|---|---|
| 92 | GET /staff-titles/ | ✅ | system/StaffTitleController.java:35 | Go 尾部斜杠差异（chi Route("/staff-titles") + Get("/")）无功能影响 |
| 93 | POST /staff-titles/ | ✅ | system/StaffTitleController.java:47 | |
| 94 | GET /staff-titles/{id} | ✅ | system/StaffTitleController.java:42 | |
| 95 | PUT /staff-titles/{id} | ✅ | system/StaffTitleController.java:52 | |
| 96 | DELETE /staff-titles/{id} | ✅ | system/StaffTitleController.java:57 | |
| 97 | POST /staff-titles/{id}/status（ToggleStatus） | ✅ | system/StaffTitleController.java:62 | |

## 十六、用户扩展字段 user-extension-fields（Go routes.go:633-636）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 98 | GET /user-extension-fields/ | ✅ | system/UserExtensionFieldController.java:31 |
| 99 | PUT /user-extension-fields/{id} | ✅ | system/UserExtensionFieldController.java:37 |

## 十七、到场题库 on-site-questions（Go routes_library.go:17-21 + 只读面 routes.go:322-323；属 library 但常被 job 用）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 100 | GET /library/on-site-questions | ✅ | library/LibraryOnSiteQuestionController.java:39 |
| 101 | GET /library/on-site-questions/{id} | ✅ | library/LibraryOnSiteQuestionController.java:48 |
| 102 | POST /library/on-site-questions | ✅ | library/LibraryOnSiteQuestionController.java:54 |
| 103 | PUT /library/on-site-questions/{id} | ✅ | library/LibraryOnSiteQuestionController.java:61 |
| 104 | DELETE /library/on-site-questions/{id} | ✅ | library/LibraryOnSiteQuestionController.java:67 |

## 十八、随机抽题 random-draw-questions（Go routes_evaluation.go:18-22）

| # | Go 接口 | 状态 | Java 对应 | 说明 |
|---|---|---|---|---|
| 105 | GET /evaluation/random-draw-questions | ✅ | evaluation/EvaluationQuestionBankController.java:158 | Java 合并在 QuestionBank 控制器内（base /api/v1/evaluation），路径相同 |
| 106 | GET /evaluation/random-draw-questions/{id} | ✅ | EvaluationQuestionBankController.java:166 | |
| 107 | POST /evaluation/random-draw-questions | ✅ | EvaluationQuestionBankController.java:171 | |
| 108 | PUT /evaluation/random-draw-questions/{id} | ✅ | EvaluationQuestionBankController.java:176 | |
| 109 | DELETE /evaluation/random-draw-questions/{id} | ✅ | EvaluationQuestionBankController.java:181 | |

## 十九、岗位能力测评结果 job-ability（Go routes_evaluation.go:50-53 + 只读面 routes.go:302-303）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 110 | GET /evaluation/job-ability/results | ✅ | evaluation/EvaluationJobAbilityController.java:36 |
| 111 | GET /evaluation/job-ability/results/{id} | ✅ | EvaluationJobAbilityController.java:48 |
| 112 | GET /evaluation/job-ability/results/summary | ✅ | EvaluationJobAbilityController.java:53 |
| 113 | GET /evaluation/job-ability/course-scores | ✅ | EvaluationJobAbilityController.java:58 |
| 114 | POST /evaluation/job-ability/aggregate | ✅ | EvaluationJobAbilityController.java:63 |
| 115 | GET /evaluation/job-ability/aggregate/status | ✅ | EvaluationJobAbilityController.java:68 |

## 二十、工作流/审批（Go registerWorkflowRoutes routes.go:394-406；通用域，Java 归于 controller/job）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 116 | GET /workflows | ✅ | job/JobWorkflowController.java:35 |
| 117 | POST /workflows | ✅ | JobWorkflowController.java:50 |
| 118 | GET /workflows/{id} | ✅ | JobWorkflowController.java:44 |
| 119 | PUT /workflows/{id} | ✅ | JobWorkflowController.java:56 |
| 120 | DELETE /workflows/{id} | ✅ | JobWorkflowController.java:62 |
| 121 | GET /approvals | ✅ | job/JobApprovalController.java:32 |
| 122 | POST /approvals | ✅ | JobApprovalController.java:49 |
| 123 | GET /approvals/{id} | ✅ | JobApprovalController.java:43 |
| 124 | POST /approvals/{id}/review | ✅ | JobApprovalController.java:55 |

## 二十一、通用 CSV 导入导出（Go routes.go:409-411）

| # | Go 接口 | 状态 | Java 对应 |
|---|---|---|---|
| 125 | GET /export/{entity}（通用 CSV 导出） | ✅ | ImportExportController.java:116 |
| 126 | POST /import/{entity}（通用 CSV 导入） | ✅ | ImportExportController.java:61 |
| 127 | POST /import/{entity}/preview（通用预览分发） | ✅ | ImportExportController.java:70 |

## 二十二、快照 snapshot_*（跨域顺带核对）

| # | Go 接口 | 状态 | Java 对应 | 说明 |
|---|---|---|---|---|
| 128 | GET /job/positions/{id}/snapshot | ✅ | JobPositionController.java:157 | 同 #21 |
| 129 | GET /scene/scenarios/{id}/snapshot 等其余 4 个快照（scene/lesson/evaluation×2） | ✅ | SceneScenarioController.java:129、LessonCourseController.java:130、EvaluationExamController.java:141、EvaluationQuestionBankController.java:112 | 属 scene/lesson/evaluation 域，此处仅登记存在性；Go 侧学生角色剥离答案字段的逻辑建议在对应域报告中深核 |

（#128/#129 与前面条目有交叉，统计时按 129 个 Go 端接口计：positions 21 + 岗位导入导出 4 + abilities 7 + position-abilities 4 + responsibilities 5 + position-certificates 5 + certificate-library 7 + ability-domains 5 + batches 6 + recommendations 4 + learn-roads 5 + banners 5 + landing 1 + majors 5+2导入 + industries 5+2导入 + staff-titles 6 + user-extension-fields 2 + on-site 5 + random-draw 5 + job-ability 6 + workflows/approvals 9 + 通用导入导出 3 = 129）

## ➕ Java 端新增

严格 job 域内 **无 Java 独有端点**：controller/job 下 15 个 Controller 的全部 @*Mapping 均已在上表找到 Go 端对应（JobWorkflow/JobApproval 对应 Go registerWorkflowRoutes 的 /workflows、/approvals，非新增）。

---

## 缺口 / 差异清单（Top，按重要性排序）

1. **⚠️ PUT /job/positions/{id}/save-full 响应包装不一致**（本域唯一 ⚠️）：Go 返回裸 CareerPosition（backend/go/internal/handler/position_handler.go:506），Java 返回 `{"position": dto}`（JobPositionController.java:134）。React api-client（frontend/packages/api-client/src/api/job.ts:73）与 Vue portal 均按 `{position}` 声明，即 **Java 对齐前端契约、Go 偏离自身前端声明**；迁移切换前端时需确认消费方不依赖裸返回。写语义（全量重写职责/能力/证书/专业、同事务预写库条目）两侧一致。
2. （非缺口，观察项）GET /job/public/positions：Go 有租户级 2min 缓存（routes.go:257 `cachedPublicPositions`，写操作后 clearPublicPositionsCache 主动失效 position_handler.go:641），Java publicList 未见缓存层——上线后该接口的时效性会更好、QPS 承载特征不同，建议压测关注。
3. （非缺口，观察项）鉴权模型不同：Go 走 RequireMenu 菜单驱动 RBAC（jobManageMenus ∪ 落地页菜单的只读面拆分，routes.go:255-271），Java zhiyu 控制器未见 @SaCheckPermission（应为自定义鉴权，需在安全域报告中专项核对授权面是否等价，尤其"管理面/只读面"拆分）。
4. （非缺口，观察项）Go 通用 /favorites 收藏组（routes.go:157-159 favoritesHandler）与岗位收藏三接口并存；岗位域内三接口已对齐，通用收藏组归收藏/其他域核对。
5. ❌ 缺失：无。
6–10. 无更多缺口；其余 127 个接口均为 ✅（含路径、过滤参数、默认分页 limit=50、默认排除 archived、无 GET /{id} 的资源两侧一致地都没有等细节）。

---
*生成方式：逐端点比对 Go 路由注册（routes_job.go / routes.go / router.go 辅助函数展开）与 Java @RequestMapping/@*Mapping 注解，并对 positions 主资源做了 service 级语义抽查（saveFull/clone/publicList/listTargetPositions/favorites/snapshot）。*
