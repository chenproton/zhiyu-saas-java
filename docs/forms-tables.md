# 表单与表格架构盘点与复用规范

> 更新日期：2026-08-02
> 范围：`apps/edu`（portal / job / scene / lesson / evaluation / affairs / library / superadmin）
> `apps/marketplace` 已移除，无表单表格；`packages/ui` 提供全部原语与共享组件。

## 一、系统/模块划分

| 系统 | 路由前缀 | 说明 |
|------|---------|------|
| SaaS 超管 | `/superadmin` | 租户创建/登录/套餐管理 |
| 门户（租户端） | `/portal` | 工作台、系统管理（组织用户/资源/租户）、联盟、档案 |
| 岗位系统 | `/job` | 岗位资源、历史档案库、培养路径、岗位推荐 |
| 实践场景 | `/scene` | 场景库、场景编辑（任务链/测评配置）、场景学习 |
| 课程系统 | `/lesson` | 颗粒/混合/体系化课程创建、课程学习 landing |
| 测评系统 | `/evaluation` | 题库、试卷、在线考试、岗位能力测评、评价规则 |
| 教务系统 | `/affairs` | 排课、教学计划、培养方案、审批流、批次 |
| 资源库 | `/library` | 资源、题目、知识点、证书 |

## 二、表格类型（4 大类，70 个文件使用 `<Table>`）

### 1. 标准 Table 原语（唯一底层，自带横向滚动 + 列不换行）

`packages/ui/src/components/ui/table.tsx`：外层 `overflow-x-auto`，`th/td` 默认 `whitespace-nowrap`。
移动端"最好"的页面全部基于它，**所有新表格必须用它**，禁止手写 `<table>`。

### 2. 通用表格壳组件（按场景选型）

| 壳组件 | 使用文件数 | 适用场景 | 代表页面 |
|--------|-----------|---------|---------|
| `PortalCrudPage<T>` | 28 | 简单 CRUD（搜索+表格+弹窗表单+导入） | `portal/apps/system/resource/{industries,majors,codes}`、`org-user/{org-types,accounts,roles,positions,fields,relations,graduates}`、`alliance/brands/*` |
| `PortalSidebarCrudPage<T>` | 3 | 带组织架构树侧栏的 CRUD（含批量加入部门、导入导出） | `org-user/{teachers,students}` |
| `ContentListPage<T>` | 7 | 内容资源管理全功能（状态筛选、审批流、批次分组、导入导出、共建、批量） | `job/positions`、`scene`、`evaluation/{question-banks,exams}`、`lesson/admin/courses`、`affairs/{programs,teaching-plans}` |
| `ArchiveListPage<T>` | 4 | 归档库（左侧树折叠 + 恢复/删除 + 批量） | `job/archive`、`scene/archive`、`lesson/admin/archive` |
| `BatchGroupPage` | 6 | 批次分组管理 | `job/batches`、`scene/batches`、`evaluation/batches`、`lesson/admin/batches` |
| `WorkflowConfigPage` | 6 | 审批流配置 | `job/workflows`、`scene/workflows`、`evaluation/workflows`、`lesson/admin/workflows` |
| `ApprovalListPage<T>` | 6 | 审批中心（待办/历史） | `job/approvals`、`scene/approvals`、`evaluation/approvals`、`lesson/admin/approvals` |
| `LogTableShell<T>` | 3 | 日志表格（分页+加载态） | `portal/apps/system/logs/{login,operation}` |

### 3. grid 行式布局（非 Table，仅 4 个文件保留）

`grid-cols-12` 模拟表格：`lesson/admin/_components/courses/course-list.tsx`、`portal/workspace/_components/teacher-courses-tab.tsx`、`teacher-portraits-tab.tsx`、`components/scene/scenarios/scenario-list.tsx`。
这些是卡片/网格形态（hover 操作栏、缩略图等），**不是列式表格**，保留现状。

### 4. 特例

- `ScheduleGrid`（排课周课表，7 列 × 节次行）：3 个文件共用，移动端已内置 `min-w-[760px]` 横向滚动
- `TableRowActions` / `HoverActionBar`：所有表格的行操作，不要手写 `group-hover`

## 三、表单类型（6 种承载形态 × 4 层字段封装）

### 1. 承载形态

| 形态 | 代表位置 | 说明 |
|------|---------|------|
| 整页表单 | alliance 系列 new/edit、场景/岗位/课程编辑页 | `EditorShell` 全屏或独立页面，数据量大 |
| Dialog 弹窗表单 | question/schedule/tenant/org-user/library 弹窗 | 新建/编辑小表单 |
| renderForm 内联表单 | `PortalCrudPage`/`PortalSidebarCrudPage` 传入的 `renderForm` | 弹窗内联渲染 |
| 分步向导 | position-builder（3 步）、场景（2 步）、课程（多步） | `EditorShell` + step |
| 登录/认证表单 | `/portal/login`、`/superadmin` | — |
| 搜索/筛选（非录入） | 各列表页约 25 个 | Input+Select，不算数据录入表单 |

### 2. 字段封装（2026-08 改造后）

| 封装 | 使用文件数 | 所在系统 | 决策 |
|------|-----------|---------|------|
| `FormFieldRow` / `FormFieldGrid` | 44 / 19 | 全部系统 | **默认选择**，新表单一律用它 |
| `Field` 家族（FieldGroup/Field/FieldLabel…） | 7 | 教务排课/计划/方案、测评题库/试卷/评分 | 保留（container-query 响应式，服务复杂布局），不与 FormFieldRow 互相迁移 |
| 手写裸字段 | 少量 | 复杂结构 | **合理例外**，不强求抽象 |
| `form.tsx`（react-hook-form 封装） | 0 | — | **已删除**（2026-08）：零引用死代码，勿再引入 |

## 四、复用评估结论（2026-08-13 全面复用改造后更新）

> 2026-08-13 完成一轮「重复样板收口」改造（4 个分支：前端快赢 / 后端快赢 / 前端中期 / 后端 store 钳制），以下为更新后的结论。

**已收口（不再重复）**：`SearchInput`、`EmptyState`/`TableEmptyRow`、`FormDialogFooter`、`UnderlineTabs`、`DetailPageHeader`、`FormPageShell`、Button `loading`、`ComboboxSelect`（多选统一）、`useDebouncedValue`/`useClickOutside`、api-client CRUD 工厂、`fetchAllPages` 入包、后端 `parseLimitOffset`/`safeHandler`/`store.LockByKey`/`store.MarshalJSONBytes`/`store.IsUniqueViolation`/`store.ClampLimitOffset`。

**保持现状、不再大规模抽象的决定**：

1. `FormFieldRow` 已覆盖约 90% 场景（44+ 文件引用），剩余手写均为"合理例外"（flex 开关行、多控件复合字段、双 Label 嵌套选择器），强行抽象收益低、风险高
2. 两套字段封装（FormFieldRow 与 Field 家族）并存是**有意保留**：FormFieldRow 通用简单、Field 家族服务复杂响应式布局（排课/教学计划/培养方案/题库试卷评分），可随时评估合并；普通表单禁止混用两套
3. **不建议**引入更高层抽象（schema 驱动自动表单 / react-hook-form 重构）：当前 useState 受控 + FormFieldRow 已满足全部需求，违背"简单优先"原则
4. `form.tsx`（react-hook-form）已删除（2026-08 死代码清理），`@/components/ui/form` 不可用

**只定规范、不安排重构**：

5. **`useAsync` 采用缺口**（存量约 84 处手写 loading+try/catch 样板）：新页面一律 `useAsync`（或 `useLibraryCrud` 类业务 hook），存量按模块顺手迁移，不一次性追平
6. **域类型分裂治理**（`job.ts` vs `job-source.ts`、`lesson.ts` vs `lesson-source.ts` 双份定义，约 29 个文件经 job-source/lesson-source 引用 + `lib/converters/job-converters.ts` 转换层）：以 `lib/types/*.ts`（与后端对齐）为唯一主源，新代码禁止引用 `*-source.ts`；存量引用按模块逐个收敛后删除遗留类型文件，**专项排期处理，不与其他任务混做**
7. **后端 store 层复杂列表查询**（JOIN/子查询/条件过滤等约 20 文件手写 SQL）：`ExecuteListQuery` + `ListQueryConfig` 已吸收约 2/3 场景，剩余属"合理例外"（白名单模型不适用或需连带 service/handler 链路改造），保留现状、按需渐进迁移

## 五、表单开发规范（新增/修改表单时）

1. **字段行**：一律 `<FormFieldRow label=… required=… htmlFor=… hint=…>`（`apps/edu/components/shared/form-field-row.tsx`），禁止手写 `<div className="grid gap-2"><Label>…</Label><控件/></div>`
2. **多列字段容器**：一律 `<FormFieldGrid cols={2|3}>`（移动端自动收敛一列），禁止写死 `grid-cols-2`
3. **必填星号**：用 `required` prop，禁止在 label 文本里手写 `*`
4. **说明文字**：用 `hint` prop；**错误提示**：用 `error` prop
5. **保留手写的例外**（不强制替换）：flex 开关行（Label+Switch 左右布局）、一个 Label 对应多个控件的复合字段、选择器组件内部自带 Label 的嵌套结构
6. **复杂布局表单**（排课/教学计划/培养方案/题库试卷评分）：可继续使用 `Field` 家族，但**不要**在普通表单中混用两套
7. `@/components/ui/form`（react-hook-form 封装）已删除，禁止使用

## 六、表格开发规范（新增列表页时）

1. 简单 CRUD → `PortalCrudPage`；带组织树筛选 → `PortalSidebarCrudPage`；带状态/审批/批次/导入导出的内容管理 → `ContentListPage`；归档 → `ArchiveListPage`；日志 → `LogTableShell`
2. 特殊业务列表（无法用壳组件时）：直接用 `<Table>`，**必须** `min-w-[900px]`（多列）保证移动端横向滚动，列多时给关键列设 `w-*` 固定宽度
3. 行操作 → `<TableRowActions>`；批量操作按钮 + 选中态 → 参照壳组件内置模式，不手写
4. 移动端：多列网格 `grid-cols-1 md:grid-cols-2` 起步；课表类宽网格外层 `overflow-x-auto` + `min-w-[760px]`；操作栏拥挤时折叠为 DropdownMenu（参照 `editor-shell.tsx` 的移动端菜单）
