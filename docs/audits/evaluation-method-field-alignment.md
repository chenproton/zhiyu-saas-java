# 测评方式字段前后台对齐审计

> 审计范围：学生端 `apps/edu/app/scene/landing/[id]/learn` / `evaluate` 中 7 种测评方式，与管理后台 `apps/edu/app/scene/scenarios/[id]/edit/tasks`「配置任务评价规则-测评资源」的字段对齐情况。
> 审计日期：2026-07-24

## 一、结论速览

| 类别 | 数量 | 说明 |
|------|------|------|
| 完全对齐 | 约 10 项 | 名称、权重、选题/选卷、提交要求等基础字段 |
| 后台可配/可存，学生端未展示 | 约 25 项 | 考试规则、评审流程、评价主体、测评对象等 |
| 学生端展示，后台不可配置 | 约 4 项 | 操作按钮文案、静态描述、历史结果状态/得分 |
| 存在真实缺陷 | 3 处 | `reviewSteps` 转换丢失、`requiresMaterial` 未生效、现场评审字段缺失 |

## 二、通用字段

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 测评方式名称 | 是（固定 7 种） | 是（method_key） | 是 | — |
| 方法权重 | 是 | 是（weight） | 是 | — |
| 测评描述 | **否** | **否** | 是（静态文案） | 学生端写死 `methodDescMap`，后台无对应配置项 |
| 操作按钮文案 | **否** | **否** | 是（静态文案） | 学生端写死 `methodActionText`，后台无对应配置项 |
| 历史结果状态/得分 | **否** | 是（结果表） | 是 | 后台不配置，由学生提交后产生 |
| 测评对象（个人/小组） | 是 | 是（eval_object） | **否** | 后台可配，学生端不可见 |
| 评价主体及参数 | 是 | 是（eval_subjects JSON） | **否** | 教师/企业导师/互评/自评等权重规则学生端不可见 |

## 三、按测评方式分表

### 3.1 题库（question_bank）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 选题 / 每题分数 | 是 | 是（resource_config.questionScores + 临时试卷） | **否** | 学生端只通过 `examId` 进入考试，不展示题目与分数配置 |
| 答题方式（全部作答 / 自由刷题） | 是 | 是（resource_config.drawMode） | **否** | — |
| 正确率要求 | 是 | 是（resource_config.passRate） | **否** | — |
| 时间限制 | 是 | 是（resource_config.timeLimit → 临时试卷 duration） | **否** | 考试页可能生效，但学习/提交页不展示 |
| 允许重考 | 是 | 是（resource_config.allowRetake） | **否** | — |
| 重考次数 | 是 | 是（resource_config.retakeCount） | **否** | — |
| 题目乱序 | 是 | 是（resource_config.shuffleQuestions） | **否** | — |
| 交卷后显示成绩 | 是 | 是（resource_config.showResult） | **否** | — |
| 启用条件（手动/定时/随时）及起止时间 | 是 | 是（resource_config.activationMode / scheduledTime / scheduledEndTime） | **否** | — |
| 评价点 | 是（UI 提示自动读取得分） | 是（eval_points） | 是（考试类展示） | 后台不建议配置，但学生端会展示 |

### 3.2 试卷（paper）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 选择已有试卷 | 是 | 是（resource_config.paperId） | **否** | 学生端只拿到 `paperId` 跳转 |
| 试卷权重 | 是 | 是（resource_config.paperWeight） | **否** | — |
| 考试时长 | 是 | 是（resource_config.duration） | **否** | — |
| 允许重考 | 是 | 是（resource_config.allowRetake） | **否** | — |
| 重考次数 | 是 | 是（resource_config.retakeCount） | **否** | — |
| 题目乱序 | 是 | 是（resource_config.shuffleQuestions） | **否** | — |
| 交卷后显示成绩 | 是 | 是（resource_config.showResult） | **否** | — |
| 启用条件及起止时间 | 是 | 是 | **否** | — |
| 评价点 | 是（UI 提示自动读取得分） | 是 | 是 | 同上 |

### 3.3 随堂测（quiz）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 选题 / 每题分数 | 是 | 是 | **否** | — |
| 时间限制 | 是 | 是 | **否** | — |
| 允许重考 / 次数 | 是 | 是 | **否** | — |
| 题目乱序 / 提交后展示成绩 | 是 | 是 | **否** | — |
| 启用条件及起止时间 | 是 | 是 | **否** | — |
| 评价点 | 是（UI 提示自动读取得分） | 是 | 是 | 同上 |

### 3.4 现场问答（random_draw）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 现场问答题选择 | 是 | 是（resource_config.selectedQuestionIds / customQuestions） | **否** | 学生 evaluate 页不展示题目 |
| 抽题方式（随机/手动） | 是 | 是（resource_config.drawMode） | **否** | — |
| 抽题数量 | 是 | 是（resource_config.drawCount） | **否** | — |
| 提交材料要求 | 是 | 是（resource_config.submitFormatDesc） | 是 | — |
| 评审场地/环境资源 | 是 | 是（resource_config.venueResources） | 是 | — |
| 评价点 / 量规 / Rubric | 是 | 是（eval_points / rubric_template_id） | **否** | `isTeacherLed` 主动跳过评价标准展示 |
| 评分类型（eval_points / ability_levels） | 是 | 是（score_type） | **否** | 后台默认 eval_points，无 UI 切换 |

### 3.5 现场评审（review）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 是否需要提交评审材料 | 是 | 是（resource_config.requiresMaterial） | **否（未生效）** | 学生端始终展示提交区，不按开关控制 |
| 预估提交天数 | 是 | 是（resource_config.deadlineDays） | **否** | — |
| 提交材料要求 | 是 | 是 | 是 | — |
| 评审场地/环境资源 | 是 | 是 | 是 | — |
| 允许重新提交 | 是 | 是（resource_config.allowResubmit） | **否** | — |
| 评审流程步骤 | 是 | 是（review_steps 表） | **否** | 后台配置完整流程，学生端完全不展示 |
| 评价点 / 量规 / Rubric | 是 | 是 | **否** | `isTeacherLed` 主动跳过 |
| 评分类型 | 是 | 是 | **否** | — |

### 3.6 成果评价（outcome）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 是否需要提交成果材料 | 是 | 是（resource_config.requiresMaterial） | **否（未生效）** | 学生端始终展示提交区 |
| 预估提交天数 | 是 | 是 | 是 | — |
| 提交材料格式要求 | 是 | 是 | 是 | — |
| 评价场地/环境资源 | 是 | 是 | 是 | — |
| 允许重新提交 | 是 | 是 | 是 | — |
| 评价点 / 量规 / Rubric | 是 | 是 | 是 | — |
| 评分类型 | 是 | 是 | **否** | 后台默认 eval_points，无 UI 切换 |

### 3.7 作业（homework）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 是否需要提交作业材料 | 是 | 是（resource_config.requiresMaterial） | **否（未生效）** | 学生端始终展示提交区 |
| 预估提交天数 | 是 | 是 | 是 | — |
| 作业格式要求 | 是 | 是 | 是 | — |
| 作业场地/环境资源 | 是 | 是 | 是 | — |
| 允许重新提交 | 是 | 是 | 是 | — |
| 评价点 / 评分规则 / Rubric | 是 | 是 | 是 | — |
| 评分类型 | 是 | 是 | **否** | 后台默认 eval_points，无 UI 切换 |

## 四、真实缺陷与修复项

### 4.1 `reviewSteps` 在通用转换函数中丢失
- **位置**：`packages/shared-types/src/evaluation.ts:1356`
- **现象**：`evalRuleConfigToMethods` 对 review 方法硬编码 `reviewSteps: []`。
- **影响**：虽然当前后台 `taskStateToMethodsInput` 会重新赋值绕过该函数，但任何直接调用 `evalRuleConfigToMethods` 的场景都会丢失评审步骤。
- **修复**：当 `mk === "review"` 时从 `config.reviewSteps` 读取。

### 4.2 学生端未按 `requiresMaterial` 隐藏提交区
- **位置**：`apps/edu/app/scene/landing/[id]/evaluate/page.tsx`
- **现象**：`review` / `outcome` / `homework` 始终展示材料要求与上传区域，未读取 `resourceConfig.requiresMaterial`。
- **修复**：当 `requiresMaterial === false` 时隐藏提交材料要求卡片与上传/提交按钮，提示「本测评无需提交材料」。

### 4.3 现场评审未展示 `deadlineDays` / `allowResubmit`
- **位置**：`apps/edu/app/scene/landing/[id]/evaluate/page.tsx`
- **现象**：`review` 的测评要求卡片只展示 `submitFormatDesc` 和 `venueResources`。
- **修复**：在 `isTeacherLed` 展示逻辑中补充这两个字段。

### 4.4 考试类规则未在学生端展示摘要
- **位置**：`apps/edu/app/scene/landing/[id]/evaluate/page.tsx`
- **现象**：考试类仅展示「前往考试」按钮，未展示时长、重考、启用条件等关键规则。
- **修复**：在考试跳转卡片中展示 `timeLimit`、`allowRetake`、`retakeCount`、`activationMode`、`scheduledTime`、`scheduledEndTime` 等摘要。

## 五、预期保留的差异（非缺陷）

以下差异属于设计层面，不在本次修复范围：
- **测评描述、操作按钮文案**：学生端使用静态文案，后台无对应配置项。如需自定义，需新增后台配置项。
- **历史结果状态/得分**：由学生提交后动态产生，后台不配置。
- **测评对象、评价主体及参数**：后台管理配置，学生端当前不展示。
- **评分类型 UI 切换**：后台字段存在但无 UI 切换，当前全部默认 `eval_points`。

## 六、本次修复记录

### 6.1 已修复缺陷

| 缺陷 | 修复文件 | 修复内容 |
|------|----------|----------|
| `reviewSteps` 在通用转换中丢失 | `packages/shared-types/src/evaluation.ts` | `EvalRuleConfig` 新增 `reviewSteps` 字段；`makeDefaultEvalRuleConfig` 初始化空数组；`methodsToEvalRuleConfig` 从 review 方法读取并填充；`evalRuleConfigToMethods` 不再硬编码 `[]` |
| `requiresMaterial` 开关在学生端未生效 | `apps/edu/app/scene/landing/[id]/evaluate/page.tsx` | 现场评审/成果评价/作业在 `requiresMaterial === false` 时隐藏材料要求与上传提交区，显示「本测评无需提交材料」 |
| 现场评审未展示 `deadlineDays` / `allowResubmit` | `apps/edu/app/scene/landing/[id]/evaluate/page.tsx` | 在 `isTeacherLed` 测评要求卡片中补充展示 |
| 现场评审流程步骤学生端不可见 | `apps/edu/app/scene/landing/[id]/evaluate/page.tsx` | 新增「评审流程」卡片，展示 review 方法的 `reviewSteps` |
| 考试类规则学生端不展示 | `apps/edu/app/scene/landing/[id]/evaluate/page.tsx` | 在考试跳转卡片中新增「考试规则」摘要：时长、允许重考/次数、题目乱序、交卷后显示成绩、启用方式/起止时间、正确率要求 |

### 6.2 验证结果

- `pnpm typecheck`：通过
- `pnpm lint`：通过（仅有既有 warning，无新增 error）
- `go vet ./... && go test ./...`：通过

### 6.3 修复后仍存在的差异

以下字段后台已保存，但学生端仍不展示（设计决策）：
- 考试类：具体选题/每题分数、答题方式（drawMode）
- 现场问答：具体选题、抽题方式/数量
- 现场问答/现场评审：评价点/量规（`isTeacherLed` 主动跳过）
- 通用：测评对象、评价主体及参数
