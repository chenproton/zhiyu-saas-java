# 岗位能力画像测评结果汇聚 — 开发方案

> 参考演示系统（`/projects/zhiyu-evaluation`）的 `/job-ability`、`/job-ability/results`、`/student-portrait/portraits` 页面，
> 基于本开发系统（zhiyu-saas）现有框架和数据模型进行开发。

---

## 一、业务背景

学生在完成场景任务测评（`/evaluation/scene-results`）后，每个任务的评分结果通过能力点关联关系，
反向汇聚到所属岗位的能力模型中，生成岗位能力认定得分。汇聚结果最终展示在学生画像中。

### 核心业务流程

```
岗位 ──关联──→ 场景 ──包含──→ 任务 ──评分──→ 场景评估结果（scene_evaluation_results）
  │                                                         │
  │                    认证规则配置（权重）                      │
  └──── 能力域 ──→ 能力点 ──→ 关联任务（含任务权重） ←──────────┘
                    │
                    ▼
            加权汇聚计算（每天定时）
                    │
                    ▼
         job_ability_results（岗位能力汇聚结果）
                    │
                    ▼
         student_ability_portraits（学生画像）
```

### 演示系统参考

| 演示系统页面 | 功能 | 对应本系统目标 |
|------------|------|--------------|
| `/job-ability` | 岗位认证列表 + 入口 | `/evaluation/job-ability` |
| `/job-ability/config/pos-1` | 岗位能力点权重/任务/等级映射配置 | `/evaluation/job-ability/config/[id]` |
| `/job-ability/results` | 岗位能力认定结果查看 | `/evaluation/job-ability/results` |
| `/student-portrait/portraits` | 学生画像（含岗位得分） | 复用演示系统 iframe → 本系统已集成 |

---

## 二、现有基础设施

### 2.1 数据库表（已存在）

#### 认证规则配置（evaluation schema）

```
certification_rules              ← 岗位认证规则（关联 career_position_id）
  └── certification_ability_items  ← 能力域（如"专业技能"、"岗位与行业认知"等）
        └── certification_ability_points  ← 能力点（含权重 weight、等级映射 custom_level_mapping、要求等级 required_level）
              └── certification_related_tasks  ← 关联任务（task_id + 任务权重 weight + max_score）
```

#### 场景评估链路

```
scenarios (career_position_id)   ← 场景关联岗位
  └── scenario_tasks             ← 场景任务
        └── task_eval_points (ability_point_ids JSONB)  ← 任务评分点 → 能力点关联
              └── scene_evaluation_results (eval_point_scores JSONB)  ← 学生评分结果
```

#### 汇聚结果表

```
job_ability_results               ← 岗位能力汇聚结果
  - career_position_id, user_id
  - total_ability_points, achieved_ability_points
  - achievement_rate, grade
  - class_name, major_id, major_name

student_ability_portraits         ← 学生能力画像
  - user_id, career_position_id
  - overall_grade, domain_scores (JSONB)
  - class_rank, major_rank, recommend_positions
```

### 2.2 现有 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/evaluation/certifications` | GET/POST | 认证规则 CRUD |
| `/evaluation/certifications/{id}/full` | GET | 获取完整规则（items + points + tasks） |
| `/evaluation/certifications/{id}/items` | GET/POST | 能力域配置 |
| `/evaluation/certifications/items/{id}/points` | GET/POST | 能力点配置 |
| `/evaluation/results` | GET/POST | 场景评估结果 |
| `/evaluation/portraits` | GET | 学生画像列表 |
| `/evaluation/portraits/generate` | POST | 生成画像 |

### 2.3 前端导航现状

```typescript
// apps/edu/lib/navigation-config.ts L263-270
{
  id: "result-center",
  label: "结果与认证",
  icon: "barChart",
  children: [
    { id: "scene-results", label: "场景任务评价", href: "/evaluation/scene-results", matchers: ["/evaluation/scene-results"] },
    // job-ability 仅占位，无实际页面
  ],
}
```

---

## 三、需要新增/修改的内容

### 3.1 前端页面

#### 页面一：`/evaluation/job-ability` — 岗位能力认定管理列表

**路由**：`apps/edu/app/evaluation/job-ability/page.tsx`

**功能**：展示所有已配置认证规则的岗位列表，提供配置入口和结果查看入口。

参考演示系统的 `position-list-page.tsx`，结合本系统已有的 `ContentListPage` 模式：

| 区域 | 内容 |
|------|------|
| 顶部筛选 | 岗位名称搜索、行业筛选 |
| 表格列 | 岗位名称、岗位编码、专业方向、关联能力点数、规则状态、更新时间、操作 |
| 行操作 | "配置认证规则" → `/evaluation/job-ability/config/[id]`、"查看结果" → `/evaluation/job-ability/results?positionId=[id]` |
| 批量操作 | 批量发布/下线认证规则 |
| 状态管理 | 用到 `getStatusConfig()` + `<StatusBadge>`，不得定义本地 `STATUS_CONFIG` |

**依赖 API**：
- `GET /evaluation/certifications` — 获取规则列表
- `positionApi.list()` — 获取岗位列表（已有）

#### 页面二：`/evaluation/job-ability/config/[id]` — 岗位能力认定规则配置

**路由**：`apps/edu/app/evaluation/job-ability/config/[id]/page.tsx`

**功能**：配置某个岗位的认证规则——能力域、能力点权重、等级映射、关联场景任务。

参考演示系统 `certification-rule-page.tsx`（1117 行），核心结构：

```
┌─ 页面顶部 ──────────────────────────────────────┐
│  岗位名称 + 规则状态 + 操作按钮（保存/提交/发布/撤回）    │
├─ Tab: 能力域配置 ─────────────────────────────────┤
│  能力域卡片列表                                    │
│  ┌─ 能力域 1: 岗位与行业认知 ──────────────────────┐  │
│  │  表格: 能力点名 | 要求等级 | 权重(%) | 等级映射 | 操作│  │
│  │        ↓ 展开行: 关联任务列表（任务名 | 满分 | 权重）│  │
│  └───────────────────────────────────────────────┘  │
│  ┌─ 能力域 2: 专业技能 ──────────────────────────┐   │
│  │  ... 同上 ...                                  │  │
│  └───────────────────────────────────────────────┘  │
│  ┌─ 能力域 3: 软技能 ────────────────────────────┐   │
│  │  ... 同上 ...                                  │  │
│  └───────────────────────────────────────────────┘  │
│  [+ 新增能力域]                                     │
├─ 全局设置 ────────────────────────────────────────┤
│  全局等级映射（A/B/C/D/E 分值区间）                    │
└──────────────────────────────────────────────────┘
```

**子组件**（就近放在 `_components/` 下）：

| 组件 | 文件 | 功能 |
|------|------|------|
| `AbilityItemSection` | `_components/ability-item-section.tsx` | 单个能力域卡片（可折叠，内含能力点表格） |
| `AbilityPointCard` | `_components/ability-point-card.tsx` | 单个能力点行（权重编辑、等级映射选择） |
| `RelatedTasksTable` | `_components/related-tasks-table.tsx` | 关联任务表格（内嵌在能力点展开行） |
| `TaskSelectorDialog` | `_components/task-selector-dialog.tsx` | 搜索/选择场景任务的弹窗 |
| `LevelMappingDialog` | `_components/level-mapping-dialog.tsx` | 等级映射配置弹窗（分值区间 → 等级） |
| `WeightConfigDialog` | `_components/weight-config-dialog.tsx` | 权重配置弹窗 |

**交互规范**：
- 删除确认用 `<ConfirmDialog>`
- 表格行操作用 `<TableRowActions>`
- 状态标签用 `<StatusBadge>` + `getStatusConfig()`

**依赖 API**：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/evaluation/certifications` | POST | 创建认证规则 |
| `/evaluation/certifications/{id}` | PUT | 更新规则状态 |
| `/evaluation/certifications/{id}/items` | GET/POST | 获取/保存能力域 |
| `/evaluation/certifications/items/{id}/points` | GET/POST | 获取/保存能力点 |
| `/evaluation/certifications/items/{id}/points` | PUT | 更新能力点（含关联任务） |
| `scenarioApi.list()` | GET | 获取场景列表（用于选择任务） |
| `taskApi.listByScenario()` | GET | 获取场景下的任务列表 |

#### 页面三：`/evaluation/job-ability/results` — 岗位能力认定结果

**路由**：`apps/edu/app/evaluation/job-ability/results/page.tsx`

**功能**：展示汇聚后的岗位能力认定结果。左侧岗位导航 + 右侧学生结果表格。

参考演示系统 `job-ability/results/page.tsx`（224 行）：

```
┌─ 左侧 260px ───────────┬─ 右侧 flex-1 ───────────────────────────┐
│  岗位列表                 │  PageHeaderCard + 筛选栏                │
│  ┌────────────────────┐│  ┌────────────────────────────────────┐  │
│  │ 前端开发工程师  12人││  │ 搜索框 [      ]  达标率筛选 [全部▼]  │  │
│  │ 后端开发工程师   8人││  └────────────────────────────────────┘  │
│  │ 产品经理        5人││  结果表格                                │
│  │ UI设计师        3人││  姓名 | 学号 | 班级 | 专业 | 达标率 | 等级|│
│  └────────────────────┘│  ─────────────────────────────────────  │
│                        │  张三 | 2024001 | 计科1班 | 计科 | 85% | A│
│                        │  李四 | 2024002 | 计科1班 | 计科 | 72% | B│
└────────────────────────┴──────────────────────────────────────────┘
```

**依赖 API**：
- `GET /evaluation/job-ability/results?careerPositionId=&search=&grade=&page=&limit=` — 汇聚结果查询（新建）

#### 页面四：学生画像集成（复用演示系统 iframe）

**说明**：学生画像是 HTML 页面（演示系统的 `public/student_portrait.html`），已在开发系统中通过 `portraitApi` + `PortraitTab`（iframe 嵌入）集成，无需新建页面。

**需要扩展**：
- `GET /evaluation/portraits` 返回的 `domainScores` 中纳入岗位能力汇聚得分
- `POST /evaluation/portraits/generate` 生成画像时融入岗位能力得分

### 3.2 后端 API

#### 3.2.1 认证规则配置 API（扩展现有 certification_handler.go）

现有 API 已覆盖基础 CRUD，需补充：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/evaluation/certifications/{id}/full` | PUT | 全量写入规则（items + points + tasks），用于配置页保存 |
| `/evaluation/certifications/items/{pointId}/tasks` | GET/POST/PUT/DELETE | 单个能力点的关联任务 CRUD |

#### 3.2.2 汇聚结果查询 API（新建 job_ability_result_handler.go）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/evaluation/job-ability/results` | GET | 分页查询汇聚结果。参数：`careerPositionId`, `userId`, `search`, `grade`, `page`, `limit` |
| `/evaluation/job-ability/results/{id}` | GET | 获取单条汇聚结果详情（含各能力点明细） |
| `/evaluation/job-ability/aggregate` | POST | 触发汇聚计算。参数：`careerPositionId`（必填）、`userIds`（可选，不传则计算该岗位下所有学生） |
| `/evaluation/job-ability/aggregate/status` | GET | 查询最近一次汇聚任务状态 |

#### 3.2.3 汇聚计算算法

**输入**：`careerPositionId`, `userIds?`

**处理流程**：

```
1. 加载认证规则完整配置
   ├── certification_rules (WHERE career_position_id = $1)
   ├── certification_ability_items (通过 rule_id JOIN)
   ├── certification_ability_points (通过 item_id JOIN，含 weight, required_level, custom_level_mapping)
   └── certification_related_tasks (通过 cert_point_id JOIN，含 task_id, weight, max_score)

2. 获取候选学生列表
   ├── 若指定 userIds：使用入参
   └── 否则：查询所有在关联场景下有测评记录的学生
         SELECT DISTINCT evaluatee_id FROM scene_evaluation_results
         WHERE task_id IN (related_task_ids)

3. 遍历每个学生，计算岗位能力得分：
   FOR each student:
     FOR each ability_point:
       point_score = 0
       total_task_weight = 0
       FOR each related_task:
         result = query scene_evaluation_results(task_id, evaluatee_id)
         IF result存在 AND result.total_score IS NOT NULL:
           task_score = result.total_score / result.max_score * 100
           point_score += task_score * task_weight
           total_task_weight += task_weight
       IF total_task_weight > 0:
         point_score = point_score / total_task_weight  -- 加权平均

     // 汇总岗位总分
     position_score = Σ(point_score * point_weight) / Σ(point_weight)

     // 根据等级映射确定 Grade
     grade = mapScoreToGrade(position_score, level_mapping)

     // 计算能力点达成数
     achieved_count = COUNT(point WHERE point_score >= required_threshold)
     total_count = COUNT(all ability_points)

4. Upsert 到 job_ability_results
   INSERT ... ON CONFLICT (career_position_id, user_id) DO UPDATE
```

**等级映射逻辑**（`custom_level_mapping` JSONB 字段）：
```json
[
  { "level": "未达标", "min": 0,  "max": 59 },
  { "level": "达标",   "min": 60, "max": 69 },
  { "level": "良好",   "min": 70, "max": 79 },
  { "level": "优秀",   "min": 80, "max": 89 },
  { "level": "卓越",   "min": 90, "max": 100 }
]
```

#### 3.2.4 学生画像更新

汇聚计算完成后，自动更新 `student_ability_portraits`：

| 字段 | 计算方式 |
|------|---------|
| `overall_grade` | 所有岗位汇聚结果中取最佳等级或加权平均等级 |
| `domain_scores` | 按能力域（ability item）汇总得分，写入 JSONB |
| `recommend_positions` | 按岗位得分排序，取前 3 个 |
| `class_rank` / `major_rank` | 在班级/专业同岗位学生中按总分排名 |

### 3.3 定时调度

在 Go 后端进程启动时，使用 `robfig/cron` 注册定时任务：

```go
// backend/internal/scheduler/scheduler.go
c := cron.New()
c.AddFunc("0 2 * * *", func() {
    // 每天凌晨 2:00 执行全量汇聚
    aggregateAllPositions()
})
c.Start()
```

**汇聚范围**：遍历所有 `status = 'published'` 的认证规则对应岗位。
**幂等保证**：使用 `INSERT ... ON CONFLICT DO UPDATE`，多次执行不会产生重复数据。

### 3.4 数据库变更

#### 新 migration：`0XX_job_ability_detail.up.sql`

在现有 `job_ability_results` 表上扩展：

```sql
-- 增加能力点明细字段
ALTER TABLE job_ability_results
ADD COLUMN IF NOT EXISTS ability_point_details JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS grade_history JSONB DEFAULT '[]';

-- 增加唯一约束（防止同一学生同一岗位重复记录）
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_ability_results_user_position
ON job_ability_results(career_position_id, user_id);

-- 增加汇聚日志表
CREATE TABLE IF NOT EXISTS job_ability_aggregate_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    career_position_id UUID,
    status VARCHAR(16) NOT NULL DEFAULT 'running',
    student_count INT NOT NULL DEFAULT 0,
    updated_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);
```

对应 `.down.sql`：

```sql
ALTER TABLE job_ability_results DROP COLUMN IF EXISTS ability_point_details;
ALTER TABLE job_ability_results DROP COLUMN IF EXISTS grade_history;
DROP INDEX IF EXISTS idx_job_ability_results_user_position;
DROP TABLE IF EXISTS job_ability_aggregate_logs;
```

### 3.5 导航配置更新

修改 `apps/edu/lib/navigation-config.ts`：

```typescript
{
  id: "result-center",
  label: "结果与认证",
  icon: "barChart",
  children: [
    { id: "scene-results", label: "场景任务评价", href: "/evaluation/scene-results", matchers: ["/evaluation/scene-results"] },
    { id: "job-ability", label: "岗位能力认定规则", href: "/evaluation/job-ability", matchers: ["/evaluation/job-ability"] },
    { id: "job-ability-results", label: "岗位能力认定结果", href: "/evaluation/job-ability/results", matchers: ["/evaluation/job-ability/results"] },
  ],
},
```

### 3.6 API Client 扩展

修改 `packages/api-client/src/api/evaluation.ts`：

```typescript
export const jobAbilityResultApi = {
  list: (params?: { careerPositionId?: string; search?: string; grade?: string; page?: number; limit?: number }) =>
    apiClient.get('/evaluation/job-ability/results', { params }),
  get: (id: string) =>
    apiClient.get(`/evaluation/job-ability/results/${id}`),
  aggregate: (data: { careerPositionId: string; userIds?: string[] }) =>
    apiClient.post('/evaluation/job-ability/aggregate', data),
  aggregateStatus: () =>
    apiClient.get('/evaluation/job-ability/aggregate/status'),
}
```

---

## 四、文件清单

### 新增文件

```
前端:
apps/edu/app/evaluation/job-ability/
├── page.tsx                                          # 岗位认证管理列表
├── config/
│   └── [id]/
│       └── page.tsx                                  # 岗位认证规则配置
│       └── _components/
│           ├── ability-item-section.tsx              # 能力域卡片
│           ├── ability-point-card.tsx                # 能力点行
│           ├── related-tasks-table.tsx               # 关联任务表格
│           ├── task-selector-dialog.tsx              # 任务选择弹窗
│           ├── level-mapping-dialog.tsx              # 等级映射配置
│           └── weight-config-dialog.tsx              # 权重配置
└── results/
    └── page.tsx                                      # 岗位能力认定结果

后端:
backend/internal/handler/
├── job_ability_result_handler.go                     # 汇聚结果查询 + 聚合触发
└── certification_handler.go                          # 扩展：全量写入接口

backend/internal/service/
└── job_ability_aggregator.go                         # 汇聚计算业务逻辑

backend/internal/scheduler/
└── scheduler.go                                      # 定时调度器

backend/migrations/
├── 0XX_job_ability_detail.up.sql                     # 表结构变更
└── 0XX_job_ability_detail.down.sql

API Client:
packages/api-client/src/api/evaluation.ts              # 扩展 jobAbilityResultApi
```

### 修改文件

```
apps/edu/lib/navigation-config.ts                     # 添加 job-ability 导航
packages/shared-types/src/evaluation.ts                # 扩展类型定义
packages/shared-types/src/portrait.ts                   # 扩展 portrait 类型
backend/internal/router/routes_evaluation.go           # 注册新路由
backend/internal/domain/evaluation.go                  # 扩展领域模型
```

---

## 五、开发阶段与估算

| 阶段 | 内容 | 预估文件数 | 依赖 |
|------|------|-----------|------|
| **阶段一** | 认证规则配置前端 + API 完善 | ~10 文件 | 无 |
| **阶段二** | 汇聚结果页面 | ~2 文件 | 阶段一 |
| **阶段三** | 汇聚计算后端 + 定时调度 | ~5 文件 | 阶段一 |
| **阶段四** | 学生画像数据集成 | ~2 文件 | 阶段三 |

### 开发顺序

```
阶段一（配置页）──→ 阶段二（结果页）
         └────────→ 阶段三（汇聚逻辑）──→ 阶段四（画像集成）
```

---

## 六、注意事项

1. **权重归一化**：同一能力点下的任务权重之和应为 100，同一能力域下的能力点权重之和应为 100。前端校验 + 后端兜底。
2. **并发安全**：汇聚计算使用 `INSERT ... ON CONFLICT DO UPDATE` 保证幂等，定时任务和手动触发的汇聚不会重复。
3. **tenant 隔离**：所有查询需加 `tenant_id` 过滤条件（已有中间件支持）。
4. **前端规范**：严格遵循 `AGENTS.md` 和 `components.md` 的组件使用规范——`<StatusBadge>` + `getStatusConfig()`、`<ConfirmDialog>` 确认、`<TableRowActions>` 表格操作、`<PageHeaderCard>` 页头。
5. **迁移规范**：up/down 配对，新增 migration 版本号需取当前最大 + 1。
