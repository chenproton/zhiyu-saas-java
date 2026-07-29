# 教育管理应用审计

## 核心决策

- **应用定位**：`@zhiyu/edu` 是场景化数智教学服务平台，包含 7 个子平台，100+ 页面路由。
- **七个子平台**：
  1. **统一 Portal**（`/portal`）：Bento 网格首页（12 个平台入口）、登录、工作台（教师/学生视图）、系统管理。
  2. **数字课程平台**（`/lesson`）：课程资源管理（体系课/颗粒课/混合课编辑器）、教师工作台（领课/行为采集/进度跟踪/终结评价/成绩提交/学习画像）。
  3. **岗位/职业平台**（`/job`）：岗位管理（构建向导 + AI 辅助）、学生端岗位浏览。
  4. **场景/实践平台**（`/scene`）：场景管理、任务链编辑、评价配置、学生学习页。
  5. **评价/考核平台**（`/evaluation`）：题库/试卷管理、考试使用、场景评价结果、认证规则、毕业设计、学生画像、微证书、学生端落地页。
  6. **教学资源库**（`/library`）：现场问答题库、我的资源、知识点、资源素材、证书库、能力模型管理。
  7. **超级管理员**（`/superadmin`）：跨租户管理。
- **Portal 工作台**：教师/学生双视图，按角色显示差异化内容（仪表盘、课程、评价、画像等）。
- **系统管理**：覆盖租户、组织架构、用户管理（教师/学生/毕业生/账户）、角色权限、专业/行业/资源编码、日志审计。
- **权限系统**：`menu-permissions.ts` 基于路径层级的菜单权限控制；`active-role.ts` 角色切换。
- **认证上下文**：双认证——`auth-context.tsx`（SaaS）+ `portal-auth-context.tsx`（Portal），通过 `NEXT_PUBLIC_DEFAULT_PLATFORM` 区分。
- **评测组件库**：11 个评测专用组件位于 `apps/edu/components/evaluation/`（见下方"评测专用组件"节），覆盖题库/试卷/题目/评分/选题等交互场景。
- **知识图谱组件库**：4 个知识图谱可视化组件位于 `apps/edu/components/knowledge-graph/`（D3 力导向图、数据上下文、节点详情），用于场景和岗位的知识体系展示。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 七个子平台路由 | PASS | 100+ 路由覆盖 Portal/课程/岗位/场景/评价/资源库/超管 |
| Portal 工作台 | PASS | 教师/学生双视图；12 个平台入口 |
| 系统管理 | PASS | 组织架构/用户/角色/专业/行业/日志完整覆盖 |
| 课程编辑器 | PASS | 三种课程类型各有专属编辑器 |
| 岗位构建向导 | PASS | 多步骤向导 + AI 辅助版本 |
| 任务链编辑器 | PASS | 可视化任务编排 |
| 评价平台管理 | PASS | 题库/试卷/考试/认证/毕业/画像完整管理 |
| 教学资源库 | PASS | `/library` 路由组覆盖现场问答/资源/知识点/证书/能力、学生端落地页 |
| 学生端学习页 | PASS | `/scene/landing/[id]/learn` 统一完成 7 种测评方式入口 |
| 学生端考试页 | PASS | `/evaluation/landing/exams/[id]` 承载题库/试卷/随堂测答题 |
| 场景评价结果页 | PASS | `/evaluation/scene-results` 列表与详情页支持教师评分 |
| 学生端落地页 | PASS | 5 类公开落地页 |
| 菜单权限 | PASS | 基于路径层级的权限检查 |
| 平台外壳 | PASS | 5 个 PlatformNavigationConfig 定义各子平台导航 |
| 评测专用组件 | PASS | 11 个组件覆盖题库/试卷/题目/评分/选题（详见下方） |
| 知识图谱组件 | PASS | 4 个 D3 可视化组件覆盖视图/数据/交互（详见下方） |

## 评测专用组件

> 位于 `apps/edu/components/evaluation/`，同时被课程编辑器和任务编辑器等多处复用。

| 组件 | 文件 | 用途 |
|------|------|------|
| `EvaluationListTable` | `evaluation-list-table.tsx` | 评测列表渲染器 |
| `EvaluationStatusActions` | `evaluation-status-actions.tsx` | 评测资源状态操作按钮行 |
| `QuestionFormDialog` | `question-form-dialog.tsx` | 题目创建/编辑表单 |
| `QuestionPreview` | `question-preview.tsx` | 题目预览 |
| `BankFormDialog` | `bank-form-dialog.tsx` | 题库创建/编辑表单 |
| `ExamFormDialog` | `exam-form-dialog.tsx` | 试卷创建/编辑表单 |
| `ScoreConfigDialog` | `score-config-dialog.tsx` | 评分配置 |
| `RandomQuestionDialog` | `random-question-dialog.tsx` | 随机抽题 |
| `ManualQuestionDialog` | `manual-question-dialog.tsx` | 手动选题 |
| `LevelMappingDialog` | `level-mapping-dialog.tsx` | 等级映射配置 |
| `LevelMappingDisplay` | `level-mapping-display.tsx` | 等级映射展示 |

## 知识图谱组件

> 位于 `apps/edu/components/knowledge-graph/`，用于场景和岗位的知识体系 D3 可视化。

| 组件 | 文件 | 用途 |
|------|------|------|
| `KnowledgeGraphView` | `knowledge-graph-view.tsx` | 知识图谱主视图（360 行） |
| `KnowledgeGraphD3View` | `knowledge-graph-d3-view.tsx` | D3 力导向图渲染 |
| `GraphDataContext` | `graph-data-context.tsx` | React Context 数据状态管理 |
| `GraphNodeDetail` | `graph-node-detail.tsx` | 节点详情面板 |

## 风险与约束

- **工作台数据接入**：`portal/workspace/page.tsx` 已改为从 `portalApi.workspaceDashboard` 获取公告、待办、统计等数据，原 `_data/mock-student-data.ts`/`mock-teacher-data.ts` 仅保留空占位类型定义。—— **已切换为真实 API，低危。**
- **学生端测评入口统一**：`apps/edu/app/scene/landing/[id]/evaluate` 已删除，所有测评方式统一在 `/scene/landing/[id]/learn` 内完成。考试类直接跳转考试页，非考试类通过弹窗提交。—— **已验证通过，低危。**
- **场景评价结果页高频使用**：`/evaluation/scene-results` 列表与详情页经过视觉与交互优化，包含默认场景选中、横向测评方式标签、学生卡片分组、一键满分、底部操作栏置底等。—— **已部署验证，低危。**
- **资源库模块较新**：`/library/*` 路由组覆盖 7 个管理页面 + 学生端落地页，API 依赖 `ResourceLibraryHandler`、`OnSiteQuestionLibraryHandler`、`CertificateLibraryHandler` 等。—— **模块功能完整，后续关注使用量和性能。**
