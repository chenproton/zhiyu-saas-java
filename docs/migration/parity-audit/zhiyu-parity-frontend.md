# 知与 SaaS 前端逐页对齐核对报告：React SPA（frontend/edu） vs Vue 门户（frontend/portal-vue）

> 生成时间：本次会话。数据源：`frontend/edu/src/routes.tsx`（191 条路由，含 3 条纯重定向）与 `frontend/portal-vue/src/router/index.ts` + `src/views/`。
> 图例：✅ 已对齐｜⚠️ 部分对齐（页面存在但子功能/Tab/弹窗缺失）｜❌ 缺失｜➕ Vue 新增。
> 方法：路由级全量对照 + 核心复杂页（排课、组卷、场景编辑/任务链、AI 中心、联盟、工作台、超管、岗位建模）打开两侧文件比对功能区 + 其余页面 UI 字符串/操作按钮抽查。

---

## 一、总体结论

| 状态 | 数量 | 说明 |
|---|---|---|
| ✅ 已对齐 | 180 | 含 ~12 个「导入导出入口迁移」等价对齐页（见下注） |
| ⚠️ 部分对齐 | 8 | 页面存在但有功能缺口（见第四节 Top 缺口） |
| ❌ 缺失 | 0（+2 个索引重定向未做，轻微） | 无整页缺失 |
| ➕ Vue 新增 | ~30 条路由 | 见第五节 |

**关键结论：两侧路由覆盖度极高（188 条内容路由 100% 有 Vue 对应页面），缺口集中在 8 个页内功能，最严重的是「场景测评结果详情的现场评审评分链路」与「排课的可视化网格/双视角课表」。**

> 注（入口差异，不算缺口）：React 通过共享组件 ContentListPage 在场景大厅/岗位/课程/试卷/题库等列表页内嵌「批量导入/导出」；Vue 将其集中到新增页面 `/import-export`（覆盖 positions/scenarios/courses/question-banks/questions/exams/industries/majors/organizations/students/teachers/affairs-config 12 类实体），列表页本身无按钮。本报告将这些页计为 ✅ 并加注。联盟域的成果/协议/项目三类实体不在中央导入导出页覆盖范围内，其列表页导入缺失计为 ⚠️。

---

## 二、React 全量路由表 → Vue 对照清单

### 0. 公共/独立页（4）

| React 路由 | React 页面 | Vue 对应 | 状态 | 备注 |
|---|---|---|---|---|
| /changelog | app/changelog/page | views/changelog.vue | ✅ | |
| /portal/login | app/portal/login/page | views/portal/login.vue | ✅ | 验证码登录对齐 |
| /partner/login | app/partner/login/page | views/partner/login.vue | ✅ | 含企业注册 |
| /superadmin | app/superadmin/page（2307 行） | views/superadmin/index.vue（826 行 + 5 个弹窗组件，共 2196 行） | ✅ | 已打开比对：验证码登录、学校/企业租户 CRUD、管理员管理（admin-list-dialog）、企业详情（enterprise-detail-dialog）、套餐+AI 额度配置（subscription-dialog）、平台/租户主题色（theme-color-picker）均覆盖 |

### 1. affairs 教务（16）

| React 路由 | Vue 对应 | 状态 | 备注 |
|---|---|---|---|
| /affairs/approvals | views/approvals/index.vue（props 过滤 training_program/teaching_plan） | ✅ | React 按域独立页 → Vue 聚合页按类型过滤 |
| /affairs/batches | views/affairs/batches.vue | ✅ | 两侧均为 BatchGroupPage 薄封装 |
| /affairs/config | views/affairs/scheduling-config.vue | ✅ | 学期/场地/节次参数化配置（自动生成+预览+原子保存）对齐；「导入教务配置」入口迁移至 /import-export（affairs-config 实体） |
| /affairs/majors | views/system/majors.vue | ✅ | React 侧同样是 re-export 系统专业页；批量导入两侧均有 |
| /affairs/org-structure | views/system/organizations.vue | ✅ | React 同为 re-export；组织批量导入入口在 /import-export |
| /affairs/positions | views/system/positions.vue | ✅ | React 的批量导入/导出按钮是 disabled「即将上线」占位，Vue 未保留占位按钮 |
| /affairs/programs | views/affairs/programs.vue | ✅ | |
| /affairs/programs/:id | 重定向 → views/affairs/program-edit.vue（/:id/edit，new → ?new=true） | ✅ | 已比对：基本信息/课程设置（program-courses-tab）对齐 |
| /affairs/relations | views/system/relations.vue | ✅ | React 同为 re-export |
| /affairs/scheduling | views/affairs/scheduling.vue | ⚠️ | **核心差异页（已打开两侧比对）**。对齐：两步（自定义排课→课表视图与发布）、教学计划选择、排课 CRUD 弹窗、导入排课表（预览/有效无效行）、发布（版本号+1）。差异：① React「自定义排课」是场地×节次**可视化网格编辑器**（schedule-grid-tab 502 行，含场地筛选联动、网格内直接编辑），Vue 是**普通列表+弹窗**；② React「课表视图」是**班级/教师双视角周课表网格**（timetable-view-tab 288 行，含周次筛选、草稿/已发布切换、只读网格），Vue 是普通表格（无双视角、无周筛选、无草稿/已发布切换）；③ Vue ➕ 新增「自动排课」「导出排课」 |
| /affairs/student-portraits | views/affairs/student-portraits.vue | ✅ | |
| /affairs/students | views/affairs/students.vue | ✅ | 批量导入/导出/批量毕业/批量加入班级/重置密码齐全（Vue 此页比 system 版更全） |
| /affairs/teachers | views/affairs/teachers.vue | ⚠️（轻） | React 的 affairs/teachers 直接 re-export 系统教职工页（含导入向导+导出）；Vue affairs 版（389 行）无导入/导出按钮，system 版（418 行）仅有导出。功能可由 /import-export（teachers 实体）+ system 页补偿 |
| /affairs/teaching-plans | views/affairs/teaching-plans.vue | ✅ | 行内导出对齐 |
| /affairs/teaching-plans/:id | views/affairs/teaching-plan-detail.vue | ✅ | 提交审批/撤回/发布对齐 |
| /affairs/workflows | views/workflows/index.vue | ✅ | 按域复用统一流程配置页 |

### 2. evaluation 测评（23）

| React 路由 | Vue 对应 | 状态 | 备注 |
|---|---|---|---|
| /evaluation/approvals | approvals/index.vue（exam/question_bank） | ✅ | |
| /evaluation/batches | views/evaluation/batches.vue | ✅ | 薄封装对齐（Vue 侧补了 updateStatus 直连） |
| /evaluation/exam-usage | views/evaluation/exam-usage.vue | ✅ | 创建/编辑（canEdit 规则）/开启/停止考试对齐 |
| /evaluation/exam-usage/results | views/evaluation/exam-usage-results.vue | ⚠️ | React（449 行）有**导出数据**按钮、**评分状态列（待评分/已评分）**、**查看学生考试记录详情**（含"考试记录不存在"兜底的记录视图）；Vue（157 行）仅客户端统计卡片（参考人数/平均分/最高最低/及格率）+ 成绩表格，三项均缺 |
| /evaluation/exams | views/evaluation/exams.vue | ✅ | 创建/克隆/协作人/发布/取消发布/归档/提交撤回审批/驳回原因对齐；列表批量导入导出入口迁移 /import-export |
| /evaluation/exams/:id | 重定向 → views/evaluation/exam-edit.vue（/:id/edit） | ✅ | **已打开比对**（751 vs 777 行 + 5 个题目弹窗组件）：自动抽题/手动抽题/分数配置（均匀/等比/题型分配）/拖拽排序/分值修改/发布/编辑信息/移除题目全对齐；「批量导入题目」两侧同为 disabled 占位 |
| /evaluation/job-ability | views/evaluation/job-ability.vue | ✅ | 发布/下线认证规则对齐 |
| /evaluation/job-ability/config/:id | views/evaluation/job-ability-config.vue（另有 /evaluation/job-ability-config/:id 别名） | ✅ | React 是 PositionWeightConfig 薄封装，Vue 283 行完整实现 |
| /evaluation/job-ability/results | views/evaluation/job-ability-results.vue（+别名） | ✅ | 手动汇聚/汇聚状态轮询/已达成未达成对齐 |
| /evaluation/landing | views/landing/evaluation.vue | ✅ | 统计/待考列表/去考试对齐 |
| /evaluation/landing/banks/:id | views/landing/bank-detail.vue | ✅ | 显示/隐藏全部答案、收藏、分享对齐 |
| /evaluation/landing/exam-center | views/landing/exam-center.vue | ✅ | |
| /evaluation/landing/exams（重定向） | redirect → exam-center | ✅ | |
| /evaluation/landing/exams/:id | views/landing/exam-detail.vue | ✅ | **在线考试页已比对**（1074 vs 1090 行）：答题/交卷/收藏/不限时/未开放已结束状态对齐 |
| /evaluation/lesson-results | views/evaluation/lesson-results.vue | ✅ | 待评/已评/评分对齐 |
| /evaluation/lesson-results/:id | views/evaluation/lesson-result-detail.vue | ✅ | |
| /evaluation/lesson-results/daily-exams | views/evaluation/daily-exams.vue | ✅ | |
| /evaluation/lesson-results/daily-exams/:resultId | views/evaluation/daily-exam-detail.vue | ✅ | |
| /evaluation/question-banks | views/evaluation/question-banks.vue | ✅ | 同 exams 列表；导入导出移 /import-export |
| /evaluation/question-banks/:id | 重定向 → views/evaluation/question-bank-edit.vue（/:id/edit） | ✅ | 批量导入（模板下载/overwrite/skip）/批量导出/批量复制/批量移动/批量删除全对齐（921 vs 944 行） |
| /evaluation/scene-results | views/evaluation/scene-results.vue | ✅ | 列表+评分入口对齐 |
| /evaluation/scene-results/:id | views/evaluation/scene-result-detail.vue | ⚠️ | **最大单页缺口（已打开比对）**：React 1487 行 vs Vue 193 行。Vue 缺：评审步骤选择（按步骤评价）、现场问答题（教师现场记录学生口头回答）、现场抽题、评价点逐项评分+评价标准展示、学生按评价点自评查看、成果材料/作业材料/评审材料附件的在线预览与下载、参考答案展示、"该任务未配置评分项"兜底 |
| /evaluation/workflows | workflows/index.vue | ✅ | |

### 3. job 岗位（11）

| React 路由 | Vue 对应 | 状态 | 备注 |
|---|---|---|---|
| /job/approvals | approvals/index.vue（career_position） | ✅ | |
| /job/archive | views/job/archive.vue | ✅ | 恢复/批量恢复/批量删除对齐 |
| /job/batches | views/job/batches.vue | ✅ | |
| /job/landing | views/landing/job.vue | ✅ | 公开页 |
| /job/landing/:id | views/landing/job-detail.vue | ✅ | 能力模型/胜任标准/知识图谱（登录可见）对齐 |
| /job/landing/:id/learn | views/landing/job-learn.vue | ✅ | 学习路径页（185 vs 843 行，Vue 更全） |
| /job/learn-roads | views/job/learn-roads.vue | ✅ | 拖拽排序+保存顺序（START·第1站）对齐 |
| /job/positions | views/job/positions.vue | ✅ | 审批/发布/归档/克隆/邀请共建/配置能力对齐；导入导出移 /import-export |
| /job/positions/:id/edit | views/job/position-edit.vue + position-builder/（9 个组件 4859 行） | ✅ | **已比对**：React position-builder（3487 行）三步（基础信息/能力建模/结果表）+AI 进度弹窗+封面上传+用户选择器，Vue 侧逐步对齐且更完整 |
| /job/recommend | views/job/recommend.vue | ✅ | 推荐排序对齐 |
| /job/workflows | workflows/index.vue | ✅ | |

### 4. lesson 课程（13）

| React 路由 | Vue 对应 | 状态 | 备注 |
|---|---|---|---|
| /lesson/admin/approvals | approvals/index.vue（course） | ✅ | |
| /lesson/admin/archive | views/lesson/archive.vue | ✅ | 恢复/版本/批次分组对齐 |
| /lesson/admin/batches | views/lesson/batches.vue | ✅ | |
| /lesson/admin/granular | views/lesson/courses.vue（props routeQueryType=granular） | ✅ | 三类型共用列表；克隆/邀请共建/审批/发布/归档对齐；导入导出移 /import-export |
| /lesson/admin/granular/add | views/lesson/course-granular-edit.vue | ✅ | 646 vs 3800 行，Vue 更完整（资源选择/上传） |
| /lesson/admin/hybrid | views/lesson/courses.vue（hybrid） | ✅ | |
| /lesson/admin/hybrid/add | views/lesson/course-hybrid-edit.vue | ✅ | 1534 vs 3510 行；课前/课中/课后分组、复用教学设计、教学活动挂载对齐 |
| /lesson/admin/system | views/lesson/courses.vue（system） | ✅ | |
| /lesson/admin/system/add | views/lesson/course-edit.vue | ✅ | 1440 vs 1557 行；节点测评方式（作业/题库测验/试卷测验/现场问答）、评价规则配置、颗粒课引用对齐 |
| /lesson/admin/workflows | workflows/index.vue | ✅ | |
| /lesson/landing | views/landing/lesson.vue | ✅ | |
| /lesson/landing/:id | views/landing/lesson-detail.vue | ✅ | 节点树展开/收藏/分享/评价标准对齐 |
| /lesson/landing/:id/learn | views/landing/lesson-learn.vue | ✅ | 374 vs 3051 行，Vue 更完整 |

### 5. library 资源库（8）

| React 路由 | Vue 对应 | 状态 | 备注 |
|---|---|---|---|
| /library/ability | views/library/ability.vue | ✅ | |
| /library/certificates | views/library/certificates.vue | ✅ | |
| /library/knowledge | views/library/knowledge.vue | ✅ | |
| /library/landing | views/landing/library.vue | ✅ | 公开页，时间筛选（近一周/月/年）+分类/院系/专业对齐 |
| /library/my-resources | views/library/my-resources.vue | ✅ | |
| /library/questions | views/library/questions.vue | ✅ | |
| /library/resources/:type | views/library/resources.vue（另有 /library/resources 无参路由） | ✅ | React 是 ResourcesPage 薄封装；Vue 有 ResourceBatchImportDialog/ResourcePreviewDialog/CitationStatsPanel/GranularLessonSelectDialog 等 _components 全套 |
| /library/tags | views/library/tags.vue | ✅ | |

### 6. partner 企业服务台（23）

| React 路由 | Vue 对应 | 状态 | 备注 |
|---|---|---|---|
| /partner（index → workspace 重定向） | 无对应路由（落入 404 → /portal） | ⚠️（轻微） | 仅索引重定向缺失 |
| /partner/co-build/positions | views/partner/co-build-positions.vue（+短路径别名） | ✅ | |
| /partner/co-build/positions/:id/edit | views/partner/co-build-position-edit.vue | ✅ | 与校内岗位编辑器共用 position-builder 三步 |
| /partner/co-build/scenes | views/partner/co-build-scenarios.vue（+别名） | ✅ | |
| /partner/co-build/scenes/:id/edit | views/partner/co-build-scenario-edit.vue | ✅ | |
| /partner/co-build/scenes/:id/edit/tasks | views/partner/co-build-scene-tasks.vue + co-build-scene-tasks/ 组件目录 | ✅ | 已比对：任务链/权重（一键平均分配）/克隆引用/能力点·知识·评价方式·资源选择器对齐 |
| /partner/cooperation | views/partner/cooperation.vue | ✅ | |
| /partner/employment-jobs | views/partner/employment-jobs.vue | ✅ | 发布/关闭对齐 |
| /partner/employment-jobs/new | 重定向 → employment-job-edit.vue（?new=true） | ✅ | |
| /partner/employment-jobs/:id | views/partner/employment-job-detail.vue | ✅ | 学生投递列表对齐 |
| /partner/employment-jobs/:id/edit | views/partner/employment-job-edit.vue | ✅ | |
| /partner/employment-projects | views/partner/employment-projects.vue | ✅ | |
| /partner/employment-projects/:id | views/partner/employment-project-detail.vue | ✅ | |
| /partner/enterprise | views/partner/enterprise.vue | ✅ | 对外展示开关对齐 |
| /partner/experts | views/partner/experts.vue | ✅ | |
| /partner/experts/new | 重定向 → expert-edit.vue（?new=true） | ✅ | |
| /partner/experts/:id | views/partner/expert-detail.vue | ✅ | |
| /partner/experts/:id/edit | views/partner/expert-edit.vue | ✅ | |
| /partner/login | views/partner/login.vue | ✅ | 账号登录+企业注册对齐 |
| /partner/schools | views/partner/schools.vue | ✅ | 合作状态更新/终止对齐 |
| /partner/settings | views/partner/settings.vue | ✅ | 改密对齐 |
| /partner/tasks | views/partner/tasks.vue | ✅ | |
| /partner/workspace | views/partner/workspace.vue | ✅ | 服务台统计（专家/合作学校/共建岗位场景/测评任务/资料完整度）对齐（509 vs 724 行） |

### 7. portal 门户（83）

#### 7.1 门户基础（3）

| React 路由 | Vue 对应 | 状态 | 备注 |
|---|---|---|---|
| /portal | views/portal/index.vue | ✅ | |
| /portal/login | views/portal/login.vue | ✅ | |
| /portal/workspace | views/portal/workspace.vue + workspace/ 目录 25+ 组件 | ✅ | **已比对**：学生 8 Tab（工作台首页/我的学习/我的课表/我的收藏/测评认证/学生画像/学习社区/个人中心）、教师 5 Tab、学校管理员 5 Tab（资源运营/审批中心/教师学生情况等）、企业导师走 GenericWorkspace 兜底；角色切换与 React 共用 localStorage key；教师课表/混合评分/备课关联等弹窗组件齐全 |

#### 7.2 产教联盟前台 /portal/alliance/*（15）——全部 ✅

landing、enterprises、enterprises/:id、experts、experts/:id、projects、projects/:id、achievements、achievements/:id、brands、brands/:id、employment、employment/:id、employment/job/:id、employment/mine。
已抽查：landing 精选/品牌/就业版块对齐；employment-job-detail 的**岗位投递**（投递成功/已投递/暂不可投递）对齐；brand-detail 六类品牌详情对齐。

#### 7.3 应用中心 /portal/apps（1）

| /portal/apps | views/portal/apps.vue | ✅ | |

#### 7.4 AI 智能服务中心 /portal/apps/ai/*（15）——全部 ✅

| React 路由 | Vue 对应 | 备注 |
|---|---|---|
| admin/agents、admin/kbs | views/ai/admin-content.vue（meta.aiAdminType 区分） | React 为薄封装，Vue 合并实现 |
| admin/integrations | views/ai/admin-integrations.vue | 外部 AI 服务链接卡片上架/下架对齐 |
| admin/reviews | views/ai/admin-reviews.vue | 审核工作台：统计头/驳回（可填意见）/下架对齐 |
| agents/:id | views/ai/agent-chat.vue | 流式对话+中止（abort）/思考中对齐 |
| hall/agents、hall/kbs | views/ai/hall/agents.vue、kbs.vue | 时间筛选（最近一周/一月/半年）+排序（最热/最新/浏览最多/综合排序/资源最多）对齐 |
| kb/:id | views/ai/kb-detail.vue | 库内问答对齐 |
| landing | views/ai/landing.vue | hero+我的工坊+AI 广场+YIKnow 弹窗对齐（288 vs 521 行） |
| square、studio | 均为重定向（与 React 一致 redirect 到 landing#square/#studio） | ✅ |
| studio/agents/new、studio/agents/:id | views/ai/studio/agent-new.vue、agent-edit.vue（+AgentForm 组件） | 预览对话/去对话/驳回原因/下架对齐 |
| studio/kb/new、studio/kb/:id | views/ai/studio/kb-new.vue、kb-edit.vue | 文档上传解析状态/协作者管理对齐 |

#### 7.5 联盟管理应用 /portal/apps/alliance/*（31）

| React 路由 | Vue 对应 | 状态 | 备注 |
|---|---|---|---|
| achievements | portal/apps/alliance/achievements.vue | ⚠️ | 列表 CRUD/前台展示开关对齐；**缺「批量导入」**（React 有合作成果导入向导；中央 /import-export 未覆盖联盟实体） |
| achievements/new、:id、:id/edit | achievement-edit.vue / achievement-detail.vue | ✅ | 佐证材料多图上传、关联岗位/场景/课程对齐 |
| agreements | agreements.vue | ⚠️ | **缺批量导入 + 缺行内「前台展示」开关**（React 两者均有） |
| agreements/new、:id、:id/edit | agreement-edit.vue / agreement-detail.vue | ✅ | 项目关联同步对齐 |
| brands | brands.vue | ✅ | 六类品牌入口卡片对齐 |
| brands/culture、employer、job、major、talent、teacher | brand-*.vue | ✅ | 各品牌页均含 BatchImport；teacher 页双区块（校本师资/企业专家师资）+关联弹窗经 TeacherBrandSection 对齐（React 690 行 → Vue 85+488 行组件化） |
| brands/:id | brand-detail.vue | ✅ | 关联对象（企业/岗位/专业/教师/专家）配置对齐 |
| dictionaries | dictionaries.vue | ✅ | 8 类字典（合作类型/评级/状态、成果类型、协议类型/状态、专家评级、项目类型）全对齐 |
| employmentjob | employmentjob.vue | ✅ | 下架/恢复/独立岗位对齐 |
| employmentproject、/new、/:id | employmentproject*.vue | ✅ | 发布/取消发布对齐 |
| enterprises、enterprises/:id | enterprises.vue / enterprise-detail.vue | ✅ | 引入/代注册/解除引入、详情页关联协议/项目/成果对齐 |
| experts、experts/:id | experts.vue / expert-detail.vue | ✅ | |
| permissions | permissions.vue | ✅ | 本校自建/企业共建授权、全选对齐 |
| projects | projects.vue | ⚠️ | **缺「批量导入」**（React 有；中央页未覆盖） |
| projects/new、:id、:id/edit | project-edit.vue / project-detail.vue | ✅ | 里程碑 CRUD/标记完成、关联成果/协议对齐 |
| school | school.vue | ✅ | 基础/联系/网络信息+二级学院对齐 |

#### 7.6 系统管理应用 /portal/apps/system/*（18）

| React 路由 | Vue 对应 | 状态 | 备注 |
|---|---|---|---|
| index（→ tenant 重定向） | 无对应（落 404 → /portal） | ⚠️（轻微） | 仅索引重定向缺失 |
| logs/login、logs/operation | system/logs-login.vue、logs-operation.vue | ✅ | |
| org-user/accounts | system/accounts.vue | ✅ | 启用/禁用/密码重置/角色绑定/批量删除对齐 |
| org-user/fields | system/fields.vue | ✅ | 扩展字段+适用角色对齐 |
| org-user/graduates | system/graduates.vue | ✅ | 恢复入学对齐（React 批量导出为「即将上线」占位） |
| org-user/org-structure | system/organizations.vue | ✅ | 树管理/批量毕业/导出对齐；组织批量导入入口在 /import-export（organizations 实体） |
| org-user/org-types | system/org-types.vue | ✅ | React 导入导出为占位 |
| org-user/positions | system/positions.vue | ✅ | 启用/停用对齐；React 导入导出为占位 |
| org-user/relations | system/relations.vue | ✅ | |
| org-user/roles | system/roles.vue | ⚠️ | **缺「角色权限配置」对话框**：React（764 行）含系统权限/菜单权限/数据权限 Tab 配置与保存（savePermissions），Vue（274 行）仅有角色 CRUD + 绑定用户 |
| org-user/students | system/students.vue | ✅ | 批量毕业/批量删除/导出对齐；批量导入入口在 /import-export（注：/affairs/students 路由用的是功能更全的 affairs/students.vue） |
| org-user/teachers | system/teachers.vue | ✅ | 有导出；批量导入入口在 /import-export |
| resource/codes | system/resource-codes.vue | ✅ | 公共/自定义编码对齐 |
| resource/industries、resource/majors | system/industries.vue、majors.vue | ✅ | 批量导入两侧均有 |
| resource/package | system/resource-package.vue | ✅ | |
| tenant | system/tenant.vue | ✅ | 租户信息/学校类型/AI 配置/Token 消耗/套餐对齐 |

### 8. scene 场景（10）

| React 路由 | Vue 对应 | 状态 | 备注 |
|---|---|---|---|
| /scene（场景大厅） | /scene 重定向 → views/scene/scenarios.vue | ✅ | 列表/克隆/邀请共建/批次/审批对齐；批量导入导出移 /import-export（scenarios 实体） |
| /scene/approvals | approvals/index.vue（scenario） | ✅ | |
| /scene/archive | views/scene/archive.vue | ✅ | |
| /scene/batches | views/scene/batches.vue | ✅ | |
| /scene/landing、landing/:id、landing/:id/learn | views/landing/scene*.vue | ✅ | 详情页能力模型/评价标准/任务概览/资源中心/收藏/分享对齐（Vue 1473 行 ≥ React 1090 行） |
| /scene/scenarios/:id/edit | views/scene/scenario-edit.vue | ✅ | **已比对**（956 vs 1010 行）：基础信息表单、AI 辅助编写（润色补齐/全部撤销/恢复上版/版本号）、封面上传、岗位/行业/专业/批次选择、"尚未配置 AI 服务"提示全对齐 |
| /scene/scenarios/:id/edit/tasks | views/scene/scenario-tasks.vue + evaluation-rules/ 目录 13 组件 + AiTaskChainSuggestion | ✅ | **已比对**（3274 vs 2980 行）：任务链 CRUD、克隆/引用、权重配置（一键平均分配）、AI 任务链建议（teleport 面板+10 秒撤销）、评估规则编辑器（StepCard/ScoreConfigDialog/BankQuestionSelectorPanel/PointPickerDialog/ExamFormDialog/ExamActivationConfig/StandardDialog/MixedTagEditor 等）全对齐 |
| /scene/workflows | workflows/index.vue | ✅ | |

### 9. 404

| React | Vue | 状态 | 备注 |
|---|---|---|---|
| `path="*"` → NotFound 页面 | `:pathMatch(.*)*` → 重定向 /portal | ✅（行为差异） | React 展示 404 页；Vue 静默回门户首页，无 404 提示 |

---

## 三、plus-ui（RuoYi 管理端，Java 栈专属）覆盖能力清单

> Go 栈无对应物，不计缺口。它覆盖的是「平台级系统管理/运维/脚手架」能力，与业务门户（portal-vue）不重叠：

- **system**：用户管理（user）、角色（role）、菜单（menu）、部门（dept）、岗位（post）、字典（dict）、参数配置（config）、通知公告（notice）、OSS 文件管理（oss）、客户端管理（client）
- **monitor**：服务监控（admin）、缓存监控（cache）、在线用户（online）、登录日志（logininfo）、操作日志（operlog）、SnailJob 任务监控（snailjob）、Snail AI 监控（snailai）
- **tool**：代码生成器（gen，FreeMarker 模板，vue/react 双前端栈）
- **workflow**：流程分类（category）、流程定义（processDefinition）、流程实例（processInstance）、任务（task）、SpEL 表达式（spel）、请假示例（leave）
- **ai**：AI 对话（chat）
- **demo**：demo/tree 示例；login/register/error/redirect 框架页

---

## 四、缺口 Top 10（按业务影响排序）

1. **⚠️ /evaluation/scene-results/:id 场景测评结果详情**——现场评审评分链路几乎整体缺失（评审步骤选择、现场问答/抽题、评价点逐项评分、学生自评查看、材料附件预览下载），React 1487 行 vs Vue 193 行，是最大单页缺口。
2. **⚠️ /affairs/scheduling 排课管理**——Vue 用普通列表+弹窗替代了 React 的「场地×节次可视化排课网格」与「班级/教师双视角周课表网格（周次筛选、草稿/已发布切换）」；排课核心体验降级（Vue 另增自动排课/导出）。
3. **⚠️ /portal/apps/system/org-user/roles 角色管理**——缺角色权限配置对话框（系统/菜单/数据权限 Tab），React 764 行 vs Vue 274 行。
4. **⚠️ /evaluation/exam-usage/results 考试结果**——缺导出数据、评分状态列（待评/已评）、学生考试记录详情视图。
5. **⚠️ /portal/apps/alliance/achievements 成果管理**——缺批量导入（React 有导入向导；中央 /import-export 未覆盖联盟实体）。
6. **⚠️ /portal/apps/alliance/agreements 协议管理**——缺批量导入 + 行内「前台展示」开关。
7. **⚠️ /portal/apps/alliance/projects 合作项目**——缺批量导入。
8. **⚠️ /affairs/teachers 教职工（教务域入口）**——Vue affairs 版缺导入/导出按钮（system 版有导出；/import-export 可补导入）。
9. **⚠️（轻微）/partner 与 /portal/apps/system 索引重定向缺失**——React 分别重定向到 workspace/tenant，Vue 落入 404 兜底跳 /portal。
10. **行为差异：404 处理**——React 有专门 NotFound 页，Vue 未命中路由静默重定向 /portal，用户无感知。

---

## 五、Vue 新增（➕，React 无对应路由，约 30 条）

- **门户功能**：/portal/community（学习社区独立页，React 仅 workspace 内 Tab）、/portal/favorites（我的收藏独立页，同上）、/login（登录别名）
- **效率工具**：/import-export（集中导入导出中心，覆盖 12 类实体——这是 Vue 对 React 分散导入入口的重新组织）、/approvals、/workflows（跨域聚合页，React 只有按域拆分）
- **管理入口补齐**：/users（用户管理）、/affairs/archive、/evaluation/archive（React 教务/测评域无归档页）、/affairs/scheduling-config（独立路由，React 走 /affairs/config）、/lesson/courses、/lesson/batches、/lesson/archive、/lesson/courses/:id/edit、/lesson/courses/hybrid/add（非 admin 别名）
- **短路径/兼容别名**：/alliance/projects|agreements|achievements|brands（联盟管理快捷入口）、/system/organizations|roles|majors|industries|org-types、/ai/* 8 条旧路径重定向、/partner/co-build-positions、/partner/co-build-scenarios、/evaluation/job-ability-config/:id、/evaluation/exam-usage-results 等

---

## 六、备注

- 两侧均存在占位实现：React「批量导入题目」（exams/[id]）与 Vue 同为 disabled；React 系统域 positions/org-types/graduates 的批量导入导出为「即将上线」占位，Vue 未保留这些占位按钮（不算缺口）。
- React 教务域 /affairs/majors、org-structure、positions、relations、students、teachers 均为系统模块页面的 re-export；Vue 以路由别名复用 system/* 组件（students/teachers 例外：Vue 拆成了 affairs 版与 system 版两个实现，内容略有差异，见 ⚠️ 第 8 条）。
- 字符串重合度抽查（自研脚本，提取 React t() 与 Vue label/title/模板文本比对）用于辅助定位差异；所有 ⚠️ 结论均经打开文件人工核实。
