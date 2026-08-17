---
name: exp-sediment
description: |
  当需要沉淀本次会话或最近提交中产生的经验、将隐性知识转化为可复用资产（Skills、CLAUDE.md、Memory、docs）时自动使用此 Skill。对应 `/exp` 命令的详细执行指南。

  触发场景（产出经验 - 写入）：
  - 用户说"沉淀经验 / 总结本次会话 / 把这个记下来"
  - 用户说"这个以后还会遇到 / 避免下次再踩坑"
  - 会话末尾用户询问"有什么可以沉淀的"
  - 需要从 git log 中抽取可复用模式
  - 需要识别现有技能的漏洞并补强
  - 需要审计经验资产健康度（过时/冗余/孤岛）

  触发场景（消费经验 - 读取）：
  - 用户说"以前怎么处理 / 之前的方案 / 之前踩过 / 上次怎么解决"
  - 用户问"有没有遇到过类似问题 / 历史经验里有吗"
  - 用户说"查一下记录 / 查笔记 / 查沉淀"
  - 解决问题前希望先看历史踩坑记录避免重蹈覆辙

  触发词：沉淀经验、经验沉淀、总结会话、记下来、记录经验、self-evolution、自我进化、/exp、exp review、反哺框架、经验审计、技能漏洞、新增禁令、避免再踩坑、以前怎么处理、之前的方案、之前踩过、历史经验、查记录、查笔记、查沉淀、有没有遇到过、上次怎么解决、类似问题
---

# 经验沉淀指南（Experience Sedimentation）

## 概述

本技能是 `/exp` 命令的详细执行指南。它解决一个关键问题：**每次会话产生的隐性知识（踩坑心得、反复纠正、重复模式）如果不主动沉淀，就会随会话结束而蒸发**。

本技能把这些隐性知识按 6 类分类，分发到正确的去向（Skills / CLAUDE.md / Memory / docs / Commands），并在子项目下提供**反哺框架**的机制。

**适用仓库**：
- **框架仓库**（base-dev-framework6-java）：沉淀通用经验，供子项目同步引用
- **子项目仓库**（基于框架创建的业务项目）：沉淀业务经验，同时识别"应反哺到框架"的候选

**核心理念**：
- **Why 优先**：每条经验必须带"为什么"，否则是僵尸经验
- **优先更新不优先新建**：现有技能漏洞 > 新建技能，避免技能爆炸
- **交互式确认**：用户是最终决定者，模型只负责识别和建议

---

## 仓库模式识别

### 识别逻辑

```
1. 读取 .claude/exp.config.json
   存在 → 使用 mode 字段
   不存在 → 继续
2. 启发式判断：
   .framework-sync.json（框架同步标记）存在 → 子项目（subproject）
   否则 → 框架（framework）
3. 向用户确认（仅首次运行）
4. 写入 .claude/exp.config.json 缓存
```

### 配置文件格式

```json
{
  "mode": "framework",
  "frameworkRepo": "https://<内部Git地址>/base-dev-framework6-java.git",
  "subprojectName": "xxx-project",
  "createdAt": "2026-04-18T10:00:00+08:00"
}
```

### 模式差异表

| 维度 | framework 模式 | subproject 模式 |
|------|--------------|----------------|
| 技能沉淀 | `.claude/skills/xxx/SKILL.md` | `.claude/project-skills/xxx/SKILL.md` |
| 禁令沉淀 | 根目录 `CLAUDE.md` 禁止表 | `.claude/PROJECT.md` |
| Memory | 用户全局目录（见下方注解） | 同左 |
| Codex 镜像 | ✅ 必须同步 `.codex/skills/` | ❌ 子项目不维护 |
| 反哺机制 | - | ✅ `.claude/docs/experience/feedback-to-framework.md` |
| 只读目录 | - | `.claude/skills/*`、根 `CLAUDE.md`（框架原始文件） |

> **Memory 实际路径**：不在仓库内，而在 `C:\Users\<user>\.claude\projects\<project-slug>\memory\`（Windows）或 `~/.claude/projects/<project-slug>/memory/`（macOS/Linux）。`<project-slug>` 是项目绝对路径的转义形式（`/` 替换为 `-`）。两个模式都使用同一位置；本文档下方"目录结构参考"中画在仓库内的 `memory/` 仅是逻辑示意。

---

## 六类经验的识别信号与去向

### ① 新技能候选

**识别信号**：
- 同类问题在会话中反复出现 ≥ 2 次
- 现有技能（执行 `ls .claude/skills/` 查看清单）的 description 均无法覆盖
- 用户暗示"这块我们之前没有成熟做法"

**判断清单**：
- [ ] 查过 `.claude/skills/` 列表，无重叠
- [ ] 能提炼出至少 3 个具体触发场景
- [ ] 内容足够形成 200+ 行文档（否则应并入现有技能）

**去向**：
- framework：委托 add-skill 技能创建 `.claude/skills/xxx/`
- subproject：创建 `.claude/project-skills/xxx/SKILL.md`（不被框架同步覆盖）

**重要**：✅ 优先考虑"现有技能漏洞"（②）而非新建。新建门槛应严格。

---

### ② 现有技能漏洞

**识别信号**：
- 会话中激活了某技能但仍答错
- 用户补充了该技能文档里没有的规则
- 某技能缺少常见边界场景说明

**判断清单**：
- [ ] 定位到具体哪个 Skill
- [ ] 找到该 Skill 内应该插入的章节
- [ ] 有明确的"为什么"理由（而非"感觉更好"）

**去向**：
- framework：Edit `.claude/skills/yyy/SKILL.md` + 同步 `.codex/skills/yyy/SKILL.md`
- subproject：追加到 `.claude/docs/experience/feedback-to-framework.md`，不直接改框架文件

**写入模板**：
```markdown
## {章节名}（建议插入在 "常见错误" 或 "最佳实践" 下方）

### {具体问题/规则}

**错误做法**：{代码/配置}

**正确做法**：{代码/配置}

**Why**：{为什么必须这样，来源 - 引用会话/commit/bug}
```

---

### ③ 新禁令/规范

**识别信号**：
- 用户说"以后不要…" / "禁止…" / "永远别…"
- 用户纠正代码风格（命名、格式、引用方式）
- 用户补充了一条"看似显而易见但容易忘"的规则

**判断清单**：
- [ ] 是普适规则（不是一次性修复）
- [ ] 有对应的"错误写法"可举例
- [ ] 不与现有禁令重复

**去向**：
- framework：
  - 后端/前端通用禁令 → `CLAUDE.md` 的"绝对禁止的写法"表
  - Bash/Shell 禁令 → `CLAUDE.md` 的"Bash/Shell 禁止项"章节
  - 特定领域（如支付）→ 对应 Skill 的"常见错误"章节
- subproject：`.claude/PROJECT.md`

**写入模板**（CLAUDE.md 禁止表新行）：
```markdown
| **{分类}** | `{错误写法}` | `{正确写法}` |
```

并在文件末尾或相关章节补一条 Why 说明（简短）：
```markdown
> **Why {禁令名}**：{原因，例如"Windows 的 nul 设备在某些 Shell 环境下不被识别，会被当作普通文件名创建"}
```

---

### ④ 用户偏好 / 项目事实（Memory）

**识别信号**：
- 用户描述自己的工作习惯
- 用户透露项目约束（客户/部署环境/历史债务）
- 用户明确说"记住这个"

**与禁令的区别**：
- 禁令是**普适规则**（任何人都适用）→ 写 CLAUDE.md
- 偏好/事实是**当前用户/项目特定的** → 写 memory/

**判断清单**：
- [ ] 只对当前用户/项目有效
- [ ] 能在未来会话中用到
- [ ] 非 ephemeral（不是"今天想做 X"这种临时状态）

**去向**：`memory/{type}_{slug}.md` + 更新 `memory/MEMORY.md` 索引

**类型选择**（严格按 CLAUDE.md 的 auto memory 章节）：
- `user` - 用户角色/偏好
- `feedback` - 用户纠正/确认的做法
- `project` - 项目上下文
- `reference` - 外部系统指针

**写入模板**：
```markdown
---
name: {memory 名称}
description: {一句话描述}
type: feedback | user | project | reference
---

{规则/事实本身}

**Why**：{原因}
**How to apply**：{什么场景触发)
```

---

### ⑤ 最佳实践文档

**识别信号**：
- 本次会话产出了完整的"怎么做"流程（多步骤）
- 内容不够通用到做成 Skill，但值得保存
- 是"一次性复杂解决方案"的全流程记录

**判断清单**：
- [ ] 多步骤（≥ 5 步）
- [ ] 涉及多个文件/模块
- [ ] 有独特的决策/权衡过程

**去向**：`.claude/docs/experience/YYYY-MM/YYYY-MM-DD-{主题}.md`

**写入模板**：
```markdown
# {主题}

**日期**：YYYY-MM-DD
**场景**：{为什么要做这件事}
**模式**：framework | subproject

## 问题

{要解决的具体问题}

## 方案选择

{对比了哪些方案，为什么选这个}

## 实施步骤

1. ...
2. ...

## 关键决策点

| 决策 | 选项 | 选择 | 理由 |

## 踩坑记录

| 问题 | 排查 | 解决 |

## 可复用部分

- [ ] 将来可以抽为 Skill 的部分：...
- [ ] 纯一次性、不可复用：...
```

---

### ⑥ 高频命令候选

**识别信号**：
- 某组操作在一周内出现 ≥ 3 次
- 操作步骤多但固定
- 用户每次都要口述同样的流程

**判断清单**：
- [ ] 步骤 ≥ 5 且每次都相同
- [ ] 没有对应的现有命令
- [ ] 值得用户键入 `/xxx` 快速触发

**去向**：
- framework：`.claude/commands/xxx.md` + `.codex/skills/xxx/SKILL.md`（加 YAML 头）
- subproject：**慎重**——先观察，门槛比框架更高

---

## 执行流程详解

### Step 1 - 输入收集

```bash
# Git 信号
git log --since="7 days ago" --pretty="%h %s %an" --no-merges
git diff --stat
git status --short

# 任务信号
ls docs/tasks/active/ 2>/dev/null

# 去重基准（上次 /exp 沉淀过什么）
find .claude/docs/experience -name "*-exp-summary.md" -type f | sort | tail -3
```

**会话 transcript 扫描**（模型自主）：

纠正信号关键词：
- "不要" / "禁止" / "错了" / "以后" / "应该" / "正确做法"

反复信号：
- 同一关键词在会话中出现 ≥ 2 次
- 用户多次纠正同一错误

惊讶信号：
- "原来" / "没想到" / "居然" / "居然还有这种坑"

---

### Step 2 - 候选分类

对每个识别出的信号：

```
1. 计算置信度（见下方评分表）
2. 选择类型（① ~ ⑥）
3. 确定建议去向
4. 子项目模式：标注归属（本项目专属 / 框架通用反哺）
5. 查询去重基准，如已沉淀则跳过
```

**置信度评分表**：

| 证据 | 分值 |
|------|-----|
| 用户明确说"记住 / 以后 / 不要 / 必须" | +3 |
| 同类信号出现 2 次以上 | +2 |
| 仅 1 次出现 | +1 |
| 有清晰的 Why 描述 | +1 |
| 能映射到具体文件/Skill | +1 |
| 有对应的 commit 支持 | +1 |

**阈值**：
- ≥ 5：**高**（推荐自动沉淀）
- 3-4：**中**（逐项确认）
- 1-2：**低**（默认跳过，除非用户全选）

---

### Step 3 - 候选表展示

格式见 `.claude/commands/exp.md` 第三步。

**关键字段**：
- 摘要（一句话）
- 类型编号（①～⑥）
- 置信度（高/中/低）
- 建议去向（具体文件路径）
- 归属（子项目模式额外列）

**展示上限**：最多 10 条。超出部分压缩到一条"其他观察"。

---

### Step 4 - 逐项确认

每条候选展示：

```markdown
## 候选 #N：{摘要}

**原始信号**：{引用会话/commit 原文}
**类型**：{①~⑥}
**置信度**：{高/中/低}
**建议去向**：{文件路径 + 章节}

**预览写入内容**：
---
{完整的即将写入的内容}
---

**Why**（必填）：{为什么值得沉淀}

操作：
[Y] 写入   [E] 编辑后写入   [S] 跳过   [M] 换个去向   [W] Why 不够清晰，需要补充
```

**关键约束**：
- 若 **Why 缺失或模糊** → 必须走 `[W]` 分支补充，不允许直接写入
- 若 **归属不确定**（子项目）→ 必须要求用户选择

---

### Step 5 - 分发执行

根据类型调用对应的工具链：

#### ① 新技能

```
→ 读 .claude/skills/add-skill/SKILL.md 完整执行：
  - YAML 头部规范
  - 文档结构
  - 声明到 hook + AGENTS.md
  - 同步 .codex/skills/
```

#### ② 现有技能漏洞

```
framework 模式：
  Edit .claude/skills/{target}/SKILL.md
  cp .claude/skills/{target}/SKILL.md .codex/skills/{target}/SKILL.md
  diff 验证一致

subproject 模式：
  追加到 .claude/docs/experience/feedback-to-framework.md
  （不直接改框架文件）
```

#### ③ 新禁令

```
framework 模式：
  Edit CLAUDE.md 禁止表（根据类型找到正确的表）
  若是特定领域 → 改对应 Skill 的"常见错误"章节

subproject 模式：
  Edit .claude/PROJECT.md（若不存在则先创建）
```

#### ④ Memory

```
Write memory/{type}_{slug}.md
Edit memory/MEMORY.md 追加索引行
```

#### ⑤ 文档

```
Write .claude/docs/experience/YYYY-MM/YYYY-MM-DD-{slug}.md
（按月分目录避免单目录文件过多）
```

#### ⑥ 新命令

```
Write .claude/commands/{cmd}.md（无 YAML）
Write .codex/skills/{cmd}/SKILL.md（加 YAML 头）
Edit .claude/hooks/skill-forced-eval.cjs（若希望参与评估）
Edit AGENTS.md 技能表
```

---

### Step 6 - 摘要归档

**必须**写入 `.claude/docs/experience/YYYY-MM/YYYY-MM-DD-exp-summary.md`：

```markdown
# /exp 沉淀摘要 - {YYYY-MM-DD HH:MM}

**仓库模式**：{framework | subproject}
**扫描范围**：会话 + 最近 N 天 commits
**识别候选**：X 条
**已沉淀**：Y 条
**已跳过**：Z 条
**耗时**：约 N 分钟

## 已沉淀

| # | 摘要 | 类型 | 去向 | 置信度 |
|---|------|------|------|-------|
| 1 | {摘要} | ③ 新禁令 | CLAUDE.md#Bash禁止项 | 高 |

## 已跳过

| # | 摘要 | 跳过原因 |
|---|------|---------|
| 3 | {摘要} | 置信度不足 |

## 反哺候选（仅子项目）

追加到 `.claude/docs/experience/feedback-to-framework.md` 的条目数：N

## 可能需要后续关注

- {待观察的模式，当前置信度不足，需要后续验证}
```

**去重价值**：下次 /exp 首先读取最近 3 次摘要，已沉淀的候选不再重复识别。

---

### Step 7 - 反哺提示（子项目模式专属）

若本次有"框架通用"归属的候选：

```markdown
🔁 反哺提示

本次追加 N 条通用经验到：
  .claude/docs/experience/feedback-to-framework.md

下次在框架仓库打开会话时，运行 `/exp review` 会看到这些候选。
可决定是否合并进框架的 .claude/skills/ 或 CLAUDE.md。

如希望立即反哺，可：
1. 复制 feedback-to-framework.md 到框架仓库
2. 在框架仓库运行 /exp review --from-subproject=<path>
```

---

## /exp review 子命令（盘点模式）

### 用途

定期审计经验资产健康度，避免"沉淀—遗忘—腐化"。

### 检查维度

#### 1. 过时技能

```bash
# 读 hook 日志（如果存在）或人工标注
# 找出超过 30 天未被激活的 Skill
```

**输出建议**：
- 合并建议（两个相似 Skill 合并）
- 精简建议（Skill 内容过期，删除某章节）
- 淘汰建议（Skill 完全过时，归档到 .claude/docs/experience/archive/）

#### 2. 冗余重叠

语义相近的 Skill 对检测（关键词/描述重叠度 > 60%）：
- 示例：log-audit ↔ security-guard
- 示例：bug-detective ↔ error-handler

**输出**：重叠报告 + 建议的边界澄清章节（类似现有 8 个技能的"🔗 关联技能边界"章节）。

#### 3. 孤岛经验

```bash
# .claude/docs/experience/ 中超过 3 个月未被引用/修改的文档
find .claude/docs/experience -name "*.md" -mtime +90
```

**输出**：列出孤岛文档，建议：
- 提炼为 Skill（如果多次被引用但从未升级）
- 归档到 archive/
- 直接删除（如果已完全过时）

#### 4. 反哺候选（框架模式专属）

读所有已知子项目的 `feedback-to-framework.md`（需要配置子项目路径列表）：

```json
// .claude/exp.config.json（框架模式下）
{
  "mode": "framework",
  "knownSubprojects": [
    { "name": "project-a", "path": "../project-a" },
    { "name": "project-b", "path": "../project-b" }
  ]
}
```

聚合所有 feedback 并去重，输出合并建议。

#### 5. Memory 腐化

```bash
# 检查 memory/ 中引用的文件/方法是否仍存在
# 如：memory 提到了 "XxxService.method" 但该方法已删除
```

**输出**：腐化条目列表 + 建议删除/更新。

### 输出路径

`.claude/docs/experience/review-reports/{YYYY}-Q{N}-audit.md`

---

## 防止过度沉淀

### 规则 1：推荐上限

每次 /exp 最多展示 **10 条候选**。超出的压缩为一条：
```
| N+1 | 其他观察（共 X 条低置信信号） | 混合 | 低 | .claude/docs/experience/raw-observations.md |
```

### 规则 2：连续跳过降级

如果某条候选在连续 2 次 /exp 中都识别出来但都被跳过 → 自动降级为"永久跳过"（追加到 `.claude/exp.ignore`）。

**`.claude/exp.ignore` 文件格式**：纯文本，每行一条记录，`#` 开头为注释。每条记录形如 `<候选slug> | <最后一次跳过时间YYYY-MM-DD> | <原因摘要>`，例如：
```
# 自动维护 - 由 /exp 在用户连续两次跳过同一候选时追加
restful-naming-suggestion | 2026-04-15 | 项目已有自定义 API 命名规范
async-task-skill-candidate | 2026-04-22 | 现有 scheduled-jobs 已覆盖
```
读取规则：每次 /exp 第二步分类前，加载本文件并按第一列 slug 与新识别候选比对，命中则跳过。

### 规则 3：摘要文档清理

当 `.claude/docs/experience/YYYY-MM/` 中的摘要超过 20 个 → 提示执行 `/exp review` 做季度整合。

### 规则 4：敏感信息过滤

以下内容**自动跳过**，不沉淀：
- 包含 token、password、secret、key 的字符串
- 看起来像真实用户数据（邮箱、手机号、身份证）
- 商业敏感信息（客户名、合同金额）

---

## 常见陷阱

### 陷阱 1：沉淀了没有 Why 的规则

**症状**：半年后读到某条禁令，不知道为什么，不敢删也不敢改。

**预防**：每条候选强制要求 Why，不完整的走 `[W]` 分支要求用户补充。

### 陷阱 2：新建技能而不是改现有技能

**症状**：技能数无序膨胀，用户激活时困惑"用哪个"。

**预防**：① 类候选必须先检查"能否归并到现有 ② 类"，add-skill 的触发门槛是"内容 ≥ 200 行 + 独立领域"。

### 陷阱 3：子项目污染框架

**症状**：子项目的业务规则被写进了框架 CLAUDE.md，下次框架同步把其他子项目搞乱。

**预防**：子项目模式下对 `.claude/skills/*` 和根 `CLAUDE.md` **只读**，业务规则只能写 `.claude/PROJECT.md`。

### 陷阱 4：重复沉淀同一条

**症状**：同一条规则在 CLAUDE.md、Skill、Memory 多处出现，彼此还略有不同。

**预防**：分发前先查找是否已有同类内容（grep 摘要关键词），命中则走"更新"而非"新增"。

### 陷阱 5：沉淀了一次性修复

**症状**：某 bug 的具体修复方法被写进禁令表，下次遇到类似场景反而造成误导。

**预防**：③ 类（禁令）判断清单必须包含"是普适规则（不是一次性修复）"。一次性修复走 ⑤ 类（文档）。

---

## 目录结构参考

```
.claude/
├── commands/
│   └── exp.md                            # 命令入口
├── skills/
│   └── exp-sediment/
│       └── SKILL.md                      # 本技能
├── exp.config.json                       # 模式配置（自动生成）
├── exp.ignore                            # 永久跳过列表（自动维护）
└── PROJECT.md                            # 仅子项目：项目业务约束

.claude/docs/experience/
├── YYYY-MM/
│   ├── YYYY-MM-DD-exp-summary.md         # 每次 /exp 摘要
│   └── YYYY-MM-DD-{主题}.md              # ⑤ 类文档
├── feedback-to-framework.md              # 仅子项目：反哺候选
├── raw-observations.md                   # 低置信信号收集（如有）
├── review-reports/
│   └── YYYY-QN-audit.md                  # /exp review 输出
└── archive/                              # 过时文档归档

memory/                                   # 跨会话记忆
├── MEMORY.md                             # 索引
├── feedback_{slug}.md
└── project_{slug}.md
```

---

## 沉淀目录读取策略

### 三档读取深度

| 档位 | 读什么 | 何时触发 | 谁触发 |
|------|------|---------|------|
| **轻量** | 最近 1 条 `*-exp-summary.md` | 每次新会话开始 | 根 `CLAUDE.md` 约定（自动） |
| **按主题** | 用关键词 grep 命中的具体文档 | 设计/排查时遇到"似曾相识"信号 | 模型主动判断 |
| **全量** | `.claude/docs/experience/` 全部 | 特定命令显式要求 | 用户输入命令 |

### 全量扫描的合法触发场景

只有以下命令/操作允许做全量扫描，避免无谓占用 context：

1. **`/exp`** — 第一步必读最近 3 条 summary 做去重（避免重复识别相同候选）
2. **`/exp review`** — 必须扫全部目录，做过时/冗余/孤岛/腐化审计
3. **`/start`** — 项目智能导航时，建议带一句"最近 N 次沉淀了 X"
4. **框架同步前**（子项目模式） — 必须读 `feedback-to-framework.md`
5. **跨子项目反哺整合**（框架仓库） — review 时聚合多个子项目的 feedback

### 何时只需轻量读

以下场景**不需要**全量扫描，最近 1 条 summary 已够用：

- 日常 CRUD / 写代码 — 核心禁令已沉淀到 CLAUDE.md / Skill / Memory，由各自机制自动加载
- 单点 bug 排查 — 按关键词 grep 命中即可
- 普通对话、继续上次任务 — 最近 summary 包含跳过/沉淀清单足够定位

### 一句话判断

**正在做的事是"基于历史经验做决策"，还是"产出新经验"？**

- 做决策（写代码/排查/设计）→ **按主题 grep**
- 产出经验（沉淀/审计/反哺）→ **全量扫**
- 普通对话 → **最近 1 条 summary 即可**

---

## 与其他技能的边界

| 技能 | 联动方式 |
|------|---------|
| `add-skill` | /exp 的 ① 类候选直接委托 add-skill 执行完整流程 |
| `task-tracker` | /exp 识别"任务已完成但未归档"，提示调用 task-tracker |
| `brainstorm` | /exp 的 ⑤ 类文档往往是 brainstorm 结论落地后的产物 |
| 框架同步 | 子项目做框架同步前应先 /exp，避免沉淀被新同步覆盖 |
| `project-navigator` | /exp 识别"代码位置经常找不到"时，提示改进 project-navigator |

---

## MVP 边界（第一期范围）

本技能当前为 MVP 版本，以下功能**暂不实现**：

- ❌ 自动统计 Skill 激活频率（依赖 hook 日志，未建立）
- ❌ 自动扫描多个子项目的 feedback-to-framework.md（需要配置路径列表）
- ❌ 非交互模式（--auto，高置信自动写入）
- ❌ 跨会话的"永久跳过"持久化（仅单次会话内生效）

以上在 MVP 稳定使用后再逐步扩展。

---

## 快速参考

### 一次标准 /exp 流程

```
用户：/exp
  ↓
模型：扫描 → 候选表（≤ 10 条）→ 用户选 [A/B/C/D]
  ↓
逐项：展示预览 → 确认 Why → [Y/E/S/M/W]
  ↓
分发：① add-skill | ② Edit Skill | ③ Edit CLAUDE.md | ④ Write memory | ⑤ Write doc | ⑥ Write command
  ↓
摘要：写 .claude/docs/experience/YYYY-MM/YYYY-MM-DD-exp-summary.md
  ↓
（子项目）追加 feedback-to-framework.md + 反哺提示
  ↓
结束
```

### 初始化检查清单

首次在一个仓库运行 /exp 时：

- [ ] 识别模式（framework / subproject）
- [ ] 写入 `.claude/exp.config.json`
- [ ] 确保 `.claude/docs/experience/` 目录存在（否则创建）
- [ ] 子项目模式：创建 `.claude/PROJECT.md`（如不存在）
- [ ] 子项目模式：创建 `.claude/docs/experience/feedback-to-framework.md`（如不存在）
