# 知育 SaaS 真实可用化改造目标

> 本文档面向参与本次改造的开发者/Agent，明确“改造完成”时的系统应达到的状态、验收标准和设计约束。

## 一、最终目标声明

将知育 SaaS 从“接口齐全但前端半 mock、权限靠硬编码”的演示态，改造为：

> **一个数据真实、租户隔离、权限可配、可部署到生产环境的多租户职业教育平台。**

改造完成后，前端面向用户的每一个列表、详情、统计、审批操作，都必须对应后端数据库中的真实记录；不同租户、不同角色的用户只能访问自己被授权的数据和功能。

## 二、改造完成后的系统特征

### 1. 无面向用户的 mock/假数据

- 所有页面展示的数据必须来自后端 API + 数据库。
- 允许保留的类型定义、工具函数、未引用死代码必须被清理。
- 对于业务确实未上线、后端暂时无法支撑的功能，前端应隐藏入口，不再用空数组/mock 数据占位。

### 2. 权限模型真正落地

- 后端 JWT Claims 携带 `identityTypeCode` 和合并后的 `roles.permissions`。
- 后端提供 `RequireIdentityType` 和 `RequirePermission` 中间件。
- 前端路由守卫、按钮显隐与后端权限策略保持一致。
- `platform_admin`、`school_admin`、`teacher`、`student`、`enterprise_hr`、`enterprise_mentor` 六种身份有明确可访问范围。

### 3. 多租户隔离

- 所有业务 list 查询默认按 `tenant_id` 过滤。
- `platform_admin`（operator 角色）作为平台运营方，可跨租户读取数据，但写入仍受限制。
- 对班级/专业敏感的查询（如教师看学生）增加 `org_node_id` / `major_id` 过滤。

### 4. 前后端 API 对接完整

- 每个前端页面或核心组件的数据来源，都能在 `lib/api.ts` 中找到对应封装函数。
- 后端 `backend/internal/router/router.go` 中已注册对应路由。
- 不再出现“组件 import mock 数据文件并使用其导出值”的情况。

## 三、各模块目标状态

### 教学资源商城（Marketplace）

- 机构入驻、资源发布、订单购买、提现、运营审核全部真实。
- `/admin/*` 仅 `platform_admin` 可访问。
- 机构用户只能操作本机构数据。

### 统一门户 & 系统管理（Portal）

- `/portal/workspace` 仅 `teacher`、`student` 可访问，展示真实课程、场景任务、考试、待办。
- `/portal/apps/system/*` 仅 `school_admin` 可访问，用于管理本租户的组织、用户、角色、专业、日志等。
- `roles.permissions` 可配置用户能访问的页面和按钮。

### 产业岗位学习平台（Job）

- 岗位、能力点、学习路径、推荐、批次全部真实。
- 岗位生命周期（草稿/提交/审批/发布/归档/撤回）状态机真实运行。

### 产业应用场景实践平台（Scene）

- 场景、任务链、任务交付物、测评配置、权重、等级映射、AI 评分全部真实。
- 场景归档从 `scene_archives` 读取，删除 `scene-archive-mock.ts` 等死代码。

### 数字课程服务平台（Lesson）

- 体系课/颗粒课/混合课、课程节点、测验、作业、混合课模块全部真实。
- 教师教学运行数据来自真实课堂记录。
- `app/lesson/teacher/learning-portrait/page.tsx` 从 `portraitApi` 读取真实学生画像，删除 `lesson-data-provider.tsx`。

### 能力评价与测评资源管理（Evaluation）

- 题库、试卷、考试、考试场次、考试结果、审批、毕业设计、学生画像、微证书全部真实。
- 对于“在线课堂评价”“智慧课程评价”等后端未支撑功能，前端隐藏入口，不再保留空状态占位。

### 运营后台（Admin）

- 仅 `platform_admin` 可进入。
- 全平台机构、资源、订单、GMV、提现、配置真实可管。

## 四、验收标准（必须全部满足）

1. **数据真实性**
   - 教师/学生工作台能看到真实的课程、场景任务、考试、待办。
   - Lesson 学习画像展示数据库中的学生能力画像。
   - 所有页面无硬编码假数据（类型定义除外）。

2. **权限正确性**
   - `platform_admin` 才能访问 `/admin/*`。
   - `school_admin` 可访问 `/portal/apps/system/*`。
   - `teacher` / `student` 只能访问 `/portal/workspace/*`。
   - 非授权用户访问受保护路由时，后端返回 403，前端跳转到合法页面。

3. **租户隔离**
   - 非 operator 用户无法查看其他租户的数据。
   - operator 可跨租户读取平台级数据。

4. **代码质量**
   - `go vet ./...` 通过。
   - `go test ./...` 通过。
   - `go build ./cmd/server/main.go` 成功。
   - `pnpm exec tsc --noEmit` 通过。
   - `pnpm lint` 通过。
   - `pnpm test` 通过。

5. **部署验证**
   - `./deploy.sh` 成功执行。
   - `pm2 status` 显示前后端进程正常。
   - `curl -sf http://127.0.0.1:8080/health` 返回 ok。
   - `curl -sf -o /dev/null http://127.0.0.1:3010/login` 可访问。

## 五、设计原则与约束

1. **最小改动原则**
   - 只做与“真实可用化”直接相关的改动，不借机重构无关代码。
   - 不将 `handler` 大规模迁移到 `service/repository` 分层。

2. **前后端一致性**
   - 前端权限判断必须与后端中间件策略一致。
   - 任何前端隐藏的后端操作，后端也必须拒绝。

3. **不破坏现有数据**
   - 数据库 migration 不得破坏已有数据。
   - 每个 `.up.sql` 必须配对 `.down.sql`（可选补丁除外）。

4. **可回滚**
   - 所有部署通过 `deploy.sh` 完成，保留 `.rollback` 快照。
   - 代码变更按阶段独立提交，便于必要时部分回滚。

5. **文档与提交分离**
   - 修改 `AGENTS.md` 或 `docs/audits/*.md` 必须独立 commit。
   - 代码 fix 中不顺手修改文档。

## 六、对改造者的操作提示

- 每次开始工作前，先读取 `PROGRESS-zhiyu-real-availability.md` 了解当前进度。
- 按“后端权限基础 → Mock 清理与 API 对接 → 后端权限改造 → 前端权限对齐 → 验证部署”的顺序推进。
- 每完成一个阶段，更新 `PROGRESS-zhiyu-real-availability.md` 并执行 git 提交。
- 遇到后端未支撑的功能，优先选择“前端隐藏入口”，而不是保留 mock 数据占位。
- 修改任何 handler 的 list 查询时，记得加 `tenant_id` 过滤。

## 七、完成标志

当以下所有检查都通过时，视为本次改造完成：

- [ ] 系统-wide 搜索不到任何被页面/组件引用的 mock 数据文件。
- [ ] 所有前端 page.tsx 直接或间接通过 `lib/api.ts` 调用后端。
- [ ] 后端所有业务 list 接口带 `tenant_id` 过滤。
- [ ] 后端敏感操作使用 `RequireIdentityType` 或 `RequirePermission` 保护。
- [ ] 前端 layout 和按钮权限与后端策略对齐。
- [ ] `go test ./...` 和 `pnpm exec tsc --noEmit` 全部通过。
- [ ] `./deploy.sh` 部署成功并通过健康检查。
