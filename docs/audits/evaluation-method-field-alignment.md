# 测评方式字段前后台对齐审计

> 审计范围：学生端 `apps/edu/app/scene/landing/[id]/learn` 中 7 种测评方式，与管理后台 `apps/edu/app/scene/scenarios/[id]/edit/tasks`「配置任务评价规则-测评资源」的字段对齐情况。
> 审计日期：2026-07-24
> 更新日期：2026-07-25（移除已删除的 `/evaluate` 中转页，统一为学习页内完成）

## 一、结论速览

| 类别 | 数量 | 说明 |
|------|------|------|
| 完全对齐 | 约 10 项 | 名称、权重、选题/选卷、提交要求等基础字段 |
| 后台可配/可存，学生端未展示 | 约 25 项 | 考试规则、评审流程、评价主体、测评对象等 |
| 学生端展示，后台不可配置 | 约 4 项 | 操作按钮文案、静态描述、历史结果状态/得分 |

学生端统一入口变更：
- **考试类（题库/试卷/随堂测）**：在学习页点击后**直接跳转** `/evaluation/landing/exams/{examId}?task=&scene=&method=&usage=` 进入考试。
- **非考试类（现场问答/现场评审/成果评价/作业）**：在学习页点击后在学习页内**弹出对话框**，展示测评要求并支持上传材料/确认参加。
- 原 `/scene/landing/[id]/evaluate` 中转页已删除，不再使用。

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

## 三、学生端统一交互入口

### 3.1 考试类测评（question_bank / paper / quiz）

在学习页「任务测评」区域点击对应卡片后，直接跳转至考试落地页：

```
/evaluation/landing/exams/{examId}?task={taskId}&scene={sceneId}&method={methodKey}&usage={usageId}
```

考试规则（时长、重考、启用条件等）在考试落地页展示，学习页卡片仅展示测评方式名称、权重与操作按钮。

### 3.2 非考试类测评（random_draw / review / outcome / homework）

在学习页点击对应卡片后，弹出「测评提交对话框」：
- 对话框顶部展示测评方式图标、名称与简要说明。
- 「测评要求」区域展示 `submitFormatDesc`、`venueResources`、`deadlineDays` 等字段。
- 「评审流程」区域展示 `reviewSteps`（仅现场评审）。
- 作业/成果评价在对话框内提供文字说明输入框与文件上传区。
- 现场问答/现场评审仅要求点击「确认参加」，由教师在评分端抽题/选择步骤。
- 提交成功后对话框展示成功状态，学习页卡片状态变为「待评分」。

## 四、按测评方式分表

### 4.1 题库（question_bank）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 选题 / 每题分数 | 是 | 是（resource_config.questionScores + 临时试卷） | **否** | 学生端直接跳转考试页，不展示题目与分数配置 |
| 答题方式（全部作答 / 自由刷题） | 是 | 是（resource_config.drawMode） | **否** | — |
| 正确率要求 | 是 | 是（resource_config.passRate） | **否** | 在考试落地页展示 |
| 时间限制 | 是 | 是（resource_config.timeLimit → 临时试卷 duration） | **否** | 在考试落地页生效并展示 |
| 允许重考 | 是 | 是（resource_config.allowRetake） | **否** | 在考试落地页展示 |
| 重考次数 | 是 | 是（resource_config.retakeCount） | **否** | 在考试落地页展示 |
| 题目乱序 | 是 | 是（resource_config.shuffleQuestions） | **否** | 在考试落地页生效 |
| 交卷后显示成绩 | 是 | 是（resource_config.showResult） | **否** | 在考试落地页生效 |
| 启用条件（手动/定时/随时）及起止时间 | 是 | 是（resource_config.activationMode / scheduledTime / scheduledEndTime） | **否** | 在考试落地页展示 |
| 评价点 | 是（UI 提示自动读取得分） | 是（eval_points） | 是（考试类展示） | 后台不建议配置，但学生端会展示 |

### 4.2 试卷（paper）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 选择已有试卷 | 是 | 是（resource_config.paperId） | **否** | 学生端直接跳转考试页 |
| 试卷权重 | 是 | 是（resource_config.paperWeight） | **否** | — |
| 考试时长 | 是 | 是（resource_config.duration） | **否** | 在考试落地页展示 |
| 允许重考 | 是 | 是（resource_config.allowRetake） | **否** | 在考试落地页展示 |
| 重考次数 | 是 | 是（resource_config.retakeCount） | **否** | 在考试落地页展示 |
| 题目乱序 | 是 | 是（resource_config.shuffleQuestions） | **否** | 在考试落地页生效 |
| 交卷后显示成绩 | 是 | 是（resource_config.showResult） | **否** | 在考试落地页生效 |
| 启用条件及起止时间 | 是 | 是 | **否** | 在考试落地页展示 |
| 评价点 | 是（UI 提示自动读取得分） | 是 | 是 | 同上 |

### 4.3 随堂测（quiz）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 选题 / 每题分数 | 是 | 是 | **否** | 在考试落地页生效 |
| 时间限制 | 是 | 是 | **否** | 在考试落地页展示 |
| 允许重考 / 次数 | 是 | 是 | **否** | 在考试落地页展示 |
| 题目乱序 / 提交后展示成绩 | 是 | 是 | **否** | 在考试落地页生效 |
| 启用条件及起止时间 | 是 | 是 | **否** | 在考试落地页展示 |
| 评价点 | 是（UI 提示自动读取得分） | 是 | 是 | 同上 |

### 4.4 现场问答（random_draw）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 现场问答题选择 | 是 | 是（resource_config.selectedQuestionIds / customQuestions） | **否** | 学生端无需抽题，由教师端评分时抽题 |
| 抽题方式（随机/手动） | 是 | 是（resource_config.drawMode） | **否** | — |
| 抽题数量 | 是 | 是（resource_config.drawCount） | **否** | — |
| 提交材料要求 | 是 | 是（resource_config.submitFormatDesc） | 是 | 在提交对话框展示 |
| 评审场地/环境资源 | 是 | 是（resource_config.venueResources） | 是 | 在提交对话框展示 |
| 评价点 / 量规 / Rubric | 是 | 是（eval_points / rubric_template_id） | **否** | `isTeacherLed` 主动跳过评价标准展示 |
| 评分类型（eval_points / ability_levels） | 是 | 是（score_type） | **否** | 后台默认 eval_points，无 UI 切换 |

### 4.5 现场评审（review）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 是否需要提交评审材料 | 是 | 是（resource_config.requiresMaterial） | 是 | 在提交对话框按开关控制提交区展示 |
| 预估提交天数 | 是 | 是（resource_config.deadlineDays） | 是 | 在提交对话框展示 |
| 提交材料要求 | 是 | 是 | 是 | 在提交对话框展示 |
| 评审场地/环境资源 | 是 | 是 | 是 | 在提交对话框展示 |
| 允许重新提交 | 是 | 是（resource_config.allowResubmit） | 是 | 在提交对话框展示 |
| 评审流程步骤 | 是 | 是（review_steps 表） | 是 | 在提交对话框「评审流程」区域展示 |
| 评价点 / 量规 / Rubric | 是 | 是 | **否** | `isTeacherLed` 主动跳过 |
| 评分类型 | 是 | 是 | **否** | — |

### 4.6 成果评价（outcome）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 是否需要提交成果材料 | 是 | 是（resource_config.requiresMaterial） | 是 | 在提交对话框按开关控制提交区展示 |
| 预估提交天数 | 是 | 是 | 是 | 在提交对话框展示 |
| 提交材料格式要求 | 是 | 是 | 是 | 在提交对话框展示 |
| 评价场地/环境资源 | 是 | 是 | 是 | 在提交对话框展示 |
| 允许重新提交 | 是 | 是 | 是 | 在提交对话框展示 |
| 评价点 / 量规 / Rubric | 是 | 是 | 是 | 在提交对话框展示 |
| 评分类型 | 是 | 是 | **否** | 后台默认 eval_points，无 UI 切换 |

### 4.7 作业（homework）

| 字段 | 后台可配置 | 后台真实保存 | 学生前台展示 | 差异说明 |
|------|:----------:|:------------:|:------------:|----------|
| 是否需要提交作业材料 | 是 | 是（resource_config.requiresMaterial） | 是 | 在提交对话框按开关控制提交区展示 |
| 预估提交天数 | 是 | 是 | 是 | 在提交对话框展示 |
| 作业格式要求 | 是 | 是 | 是 | 在提交对话框展示 |
| 作业场地/环境资源 | 是 | 是 | 是 | 在提交对话框展示 |
| 允许重新提交 | 是 | 是 | 是 | 在提交对话框展示 |
| 评价点 / 评分规则 / Rubric | 是 | 是 | 是 | 在提交对话框展示 |
| 评分类型 | 是 | 是 | **否** | 后台默认 eval_points，无 UI 切换 |

## 五、真实缺陷与修复项

### 5.1 `reviewSteps` 在通用转换函数中丢失
- **位置**：`packages/shared-types/src/evaluation-rules.ts`（原文档记录为 `evaluation.ts`，实际实现位于 `evaluation-rules.ts`）
- **现象**：`evalRuleConfigToMethods` 对 review 方法硬编码 `reviewSteps: []`。
- **影响**：虽然当前后台 `taskStateToMethodsInput` 会重新赋值绕过该函数，但任何直接调用 `evalRuleConfigToMethods` 的场景都会丢失评审步骤。
- **修复**：当 `mk === "review"` 时从 `config.reviewSteps` 读取。

### 5.2 学生端未按 `requiresMaterial` 隐藏提交区
- **位置**：`apps/edu/app/scene/landing/[id]/learn` 提交对话框
- **现象**：早期 `review` / `outcome` / `homework` 始终展示材料要求与上传区域，未读取 `resourceConfig.requiresMaterial`。
- **修复**：当 `requiresMaterial === false` 时隐藏提交材料要求卡片与上传/提交按钮，显示「本测评无需提交材料」。

### 5.3 现场评审未展示 `deadlineDays` / `allowResubmit`
- **位置**：`apps/edu/app/scene/landing/[id]/learn` 提交对话框
- **现象**：`review` 的测评要求卡片只展示 `submitFormatDesc` 和 `venueResources`。
- **修复**：在测评要求展示逻辑中补充这两个字段。

### 5.4 考试类规则未在学生端展示摘要
- **位置**：`apps/edu/app/scene/landing/[id]/learn` 早期实现
- **现象**：考试类仅展示「前往考试」按钮，未展示时长、重考、启用条件等关键规则。
- **修复**：学习页卡片保持简洁，考试规则完整展示在考试落地页 `/evaluation/landing/exams/[id]`。

### 5.5 删除 `/scene/landing/[id]/evaluate` 中转页
- **位置**：`apps/edu/app/scene/landing/[id]/evaluate/page.tsx`
- **现象**：原学生端存在独立中转页，所有测评方式都先跳转到该页再二次操作。
- **修复**：删除中转页，统一在学习页 `/scene/landing/[id]/learn` 内完成：考试类直接跳转考试页，非考试类通过对话框提交。

## 六、预期保留的差异（非缺陷）

以下差异属于设计层面，不在本次修复范围：
- **测评描述、操作按钮文案**：学生端使用静态文案，后台无对应配置项。如需自定义，需新增后台配置项。
- **历史结果状态/得分**：由学生提交后动态产生，后台不配置。
- **测评对象、评价主体及参数**：后台管理配置，学生端当前不展示。
- **评分类型 UI 切换**：后台字段存在但无 UI 切换，当前全部默认 `eval_points`。
- **考试类详细规则**：学习页卡片仅作入口，具体规则在考试落地页展示。

## 七、本次修复记录

### 7.1 已修复缺陷

| 缺陷 | 修复文件 | 修复内容 |
|------|----------|----------|
| `reviewSteps` 在通用转换中丢失 | `packages/shared-types/src/evaluation.ts` | `EvalRuleConfig` 新增 `reviewSteps` 字段；`makeDefaultEvalRuleConfig` 初始化空数组；`methodsToEvalRuleConfig` 从 review 方法读取并填充；`evalRuleConfigToMethods` 不再硬编码 `[]` |
| `requiresMaterial` 开关在学生端未生效 | `apps/edu/app/scene/landing/[id]/learn` 提交对话框 | 现场评审/成果评价/作业在 `requiresMaterial === false` 时隐藏材料要求与上传提交区，显示「本测评无需提交材料」 |
| 现场评审未展示 `deadlineDays` / `allowResubmit` | `apps/edu/app/scene/landing/[id]/learn` 提交对话框 | 在测评要求卡片中补充展示 |
| 现场评审流程步骤学生端不可见 | `apps/edu/app/scene/landing/[id]/learn` 提交对话框 | 新增「评审流程」卡片，展示 review 方法的 `reviewSteps` |
| 考试类规则学生端不展示 | `/evaluation/landing/exams/[id]` | 在考试落地页展示「考试规则」摘要：时长、允许重考/次数、题目乱序、交卷后显示成绩、启用方式/起止时间、正确率要求 |
| 学生端测评入口冗余跳转 | `apps/edu/app/scene/landing/[id]/learn` / `evaluate` | 删除 `/evaluate` 中转页，学习页内直接跳转考试页或通过对话框提交 |

### 7.2 验证结果

- `pnpm typecheck`：通过
- `pnpm lint`：通过（仅有既有 warning，无新增 error）
- `go vet ./... && go test ./...`：通过
- `./deploy.sh --branch master`：部署成功，健康检查通过

### 7.3 修复后仍存在的差异

以下字段后台已保存，但学生端仍不展示（设计决策）：
- 考试类：具体选题/每题分数、答题方式（drawMode）
- 现场问答：具体选题、抽题方式/数量
- 现场问答/现场评审：评价点/量规（`isTeacherLed` 主动跳过）
- 通用：测评对象、评价主体及参数
