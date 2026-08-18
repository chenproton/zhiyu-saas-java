---
name: add-skill
description: |
  当需要为框架增加新技能、修改现有技能、编写技能文档时自动使用此 Skill。

  触发场景：
  - 需要为新模块添加技能
  - 需要为新功能编写技能文档
  - 需要扩展框架的技能系统
  - 需要将实现步骤转化为可复用技能
  - 需要修改现有技能内容并同步到双系统
  - 需要重命名或删除现有技能

  触发词：添加技能、创建技能、新技能、技能开发、写技能、技能文档、skill 创建、修改技能、更新技能、同步技能、技能同步
---

# 技能创建与维护指南

## 概述

本指南用于在 **base-dev-framework6-java**框架中**添加新技能**和**维护现有技能**（修改、重命名、删除）。技能是框架的核心能力，通过自动评估和激活，确保代码风格和规范的一致性。

本项目 的关键架构事实，写技能时必须对齐（不要套用旧版/衍生版的概念）：

- **包名前缀**：`org.dromara.*`（不是 `com.ruoyi`、不是 `plus.ruoyi`）。
- **三层架构，无独立 DAO 层**：`Controller → Service(IXxxService + XxxServiceImpl) → Mapper`。查询条件直接在 Service 里用 `QueryBuilder.lambda(Entity.class)` / `LambdaQueryWrapper` 构建，**不存在** `DAO.buildQueryWrapper()` 这一层。
- **Entity 继承 `BaseEntity`**（`org.dromara.common.mybatis.core.domain.BaseEntity`），Mapper 继承 `BaseMapperPlus<Entity, EntityVo>`（复杂模块再叠加 `MPJBaseMapper<Entity>`）。
- **对象转换**：MapStruct-Plus，`MapstructUtils.convert(bo, Entity.class)`；BO 上标 `@AutoMapper(target=Entity.class)`。
- **响应包装**：`R<T>` / `R<Void>`；分页 `PageQuery` + `PageResult`。
- **认证授权**：Sa-Token（`@SaCheckPermission("${module}:${business}:${action}")`）。
- **前端在独立的 plus-ui 仓库**，本仓库内只有由 `backend/java/ruoyi-modules/ruoyi-gen` 代码生成器产出的 FreeMarker 模板（Vue + React 双栈），没有随仓库的前端工程目录。

> **核心原则**：`.claude/skills/` 是主目录（source of truth），`.codex/skills/` 是镜像。本仓库**同时存在** `.claude/` 与 `.codex/` 两套体系，任何技能的新增或修改，都必须同步到两个目录。Hook 脚本统一使用 `.cjs` 扩展名。

---

## Claude Commands 与 Codex Skills 的对应关系

> **Codex 支持斜杠命令吗？** 支持，但有重要限制：
> - **内置斜杠命令**：30+ 个（`/model`、`/plan`、`/personality`、`/plugins` 等），与 Claude Code 体验类似
> - **自定义 slash commands**：放在 **`~/.codex/prompts/`（仅用户级）**，每个 markdown 文件定义一条命令；支持参数语法 `$1...$9`、`$ARGUMENTS`、`$$`
> - **不支持项目级 `.codex/prompts/`**：[issue #4734](https://github.com/openai/codex/issues/4734) 已被官方 **closed as not planned**，**永远不会支持**
>
> **本项目的应对**：Claude command 没法以项目级 prompt 进 git 仓库，必须以 skill（`.codex/skills/xxx/SKILL.md`）形式镜像，让 Codex 通过自然语言匹配 description 触发。

**核心区别**：
- **Skill**：两端文件完全相同（直接复制）
- **Command**：Claude 是纯 Markdown（无 YAML 头），Codex 对应的 skill 需要**加 YAML 头部** + 相同正文

**同步规则**：
- 新增/修改/删除 Claude command 时，必须同步 `.codex/skills/` 下对应的 skill
- Codex 的 command 类 skill 必须有 YAML 头部（name + description + 触发场景 + 触发词）

### 🔴 特殊规则 1：本地命令（`*-local`）不同步到 Codex

以 `-local` 结尾的 Claude 命令（如 `sync-local`）是**仅在 Claude Code 环境使用的本地工具命令**，涉及本地开发机状态、分支、未提交配置等，**不需要**也**不应该**同步到 Codex。

**判断方法**：命令文件名是否以 `-local` 结尾。

**处理方式**：
- ✅ 只在 `.claude/commands/` 下维护
- ❌ 不在 `.codex/skills/` 下创建镜像
- ❌ 不在 `.claude/hooks/skill-forced-eval.cjs` 的技能列表中声明（它们由用户直接 `/xxx-local` 触发，不参与自动评估）

### 🔴 特殊规则 2：Skill 与 Command 同名时的处理

当一个业务领域同时存在**功能技能（skill）**和**操作命令（command）**且同名时（如 `git-workflow` 既是 Git 操作技能，又是 `/git-workflow` 命令），Codex 中两者会产生路径冲突。

**处理方式**：Codex 镜像中的 **command 版本统一加 `cmd-` 前缀**。

| 类型 | Claude 位置 | Codex 位置 |
|------|------------|-----------|
| Skill（功能文档） | `.claude/skills/git-workflow/SKILL.md` | `.codex/skills/git-workflow/SKILL.md` |
| Command（斜杠命令） | `.claude/commands/git-workflow.md` | `.codex/skills/cmd-git-workflow/SKILL.md` |

**已知应用案例**：
- `git-workflow`（skill） + `cmd-git-workflow`（command 镜像）

**YAML name 字段**：Codex 镜像内的 `name` 字段必须与目录名一致（即 `cmd-git-workflow`）。

---

## 🔴 YAML 头部强制规范（最高优先级）

> **警告**：这是创建技能时最容易出错的部分！必须严格遵守以下规范。

### 强制格式

每个 SKILL.md 文件**必须**以 YAML 头部开始，格式如下：

```yaml
---
name: {技能名称}
description: |
  {第一行：简短描述（一句话说明技能用途）}

  触发场景：
  - {场景1}
  - {场景2}
  - {场景3}
  （至少3个场景）

  触发词：{关键词1}、{关键词2}、{关键词3}、{关键词4}
  （至少5个触发词，用中文顿号或斜杠分隔）
---
```

### name 字段规范

| 规则 | 说明 | 示例 |
|------|------|------|
| **格式** | kebab-case（全小写，横线连接） | ✅ `json-serialization` |
| **禁止** | 下划线、驼峰、空格 | ❌ `json_serialization`, `jsonSerialization`, `json serialization` |
| **长度** | 2-4 个单词 | ✅ `crud-development`, `data-permission` |
| **语义** | 清晰表达技能领域 | ✅ `redis-cache`, ❌ `cache` (太宽泛) |

### description 字段规范

| 部分 | 要求 | 示例 |
|------|------|------|
| **第一行** | 一句话说明技能用途（以"当需要..."或"用于..."开头） | `当需要进行 JSON 序列化、反序列化时自动使用此 Skill。` |
| **触发场景** | 至少 3 个具体场景，每个场景一行 | `- 需要处理大数字精度问题`<br>`- 需要自定义日期格式` |
| **触发词** | 至少 5 个关键词，用顿号或斜杠分隔 | `JSON序列化、反序列化、JsonUtils、日期格式、BigDecimal` |
| **空行** | 各部分之间必须有空行 | 第一行后空一行，触发场景后空一行 |

### ✅ 正确示例

```yaml
---
name: json-serialization
description: |
  当需要进行 JSON 序列化、反序列化、数据转换时自动使用此 Skill。

  触发场景：
  - 需要处理大数字精度问题（Long/BigDecimal）
  - 需要自定义日期格式化
  - 需要进行对象与 JSON 字符串互转
  - 需要处理 JSON 验证和解析

  触发词：JSON序列化、反序列化、数据转换、JsonUtils、日期格式、精度、BigDecimal、Long、类型转换、JSON验证
---
```

### ❌ 常见错误示例

**错误 1：name 使用下划线或驼峰**
```yaml
---
name: json_serialization  # ❌ 应该用横线：json-serialization
description: |
  ...
---
```

**错误 2：description 过于简短**
```yaml
---
name: json-serialization
description: |
  JSON 序列化工具  # ❌ 缺少触发场景和触发词
---
```

**错误 3：触发词太少**
```yaml
---
name: json-serialization
description: |
  当需要进行 JSON 处理时使用。

  触发词：JSON、序列化  # ❌ 只有2个，至少需要5个
---
```

**错误 4：缺少必要的空行**
```yaml
---
name: json-serialization
description: |
  当需要进行 JSON 序列化时使用。
  触发场景：  # ❌ 第一行后应该空一行
  - 场景1
  - 场景2
  触发词：...  # ❌ 触发场景后应该空一行
---
```

**错误 5：触发场景不具体**
```yaml
---
name: json-serialization
description: |
  当需要进行 JSON 处理时使用。

  触发场景：
  - JSON 处理  # ❌ 太宽泛，应该具体说明：如"处理大数字精度问题"
  - 数据转换  # ❌ 太宽泛，应该具体说明：如"对象与 JSON 字符串互转"
---
```

### YAML 头部验证清单

创建 YAML 头部后，必须通过以下所有检查：

- [ ] `name` 使用 kebab-case 格式（全小写+横线）
- [ ] `name` 长度为 2-4 个单词
- [ ] `name` 语义清晰，不过于宽泛
- [ ] `description` 第一行是完整的一句话说明
- [ ] 第一行以"当需要..."或"用于..."开头
- [ ] 第一行后有空行
- [ ] 包含"触发场景："标题
- [ ] 至少有 3 个具体的触发场景
- [ ] 每个触发场景都具体明确（不是宽泛描述）
- [ ] 触发场景后有空行
- [ ] 包含"触发词："标题
- [ ] 至少有 5 个触发词
- [ ] 触发词用中文顿号（、）或斜杠（/）分隔
- [ ] 触发词包含技术术语和常用表达
- [ ] YAML 头部以 `---` 开始和结束

---

## 前置条件

在创建新技能前，请确保：

- [ ] **已了解项目架构**：理解 `org.dromara.*` 包名结构、三层架构（Controller→Service→Mapper，无 DAO）、MapStruct-Plus 对象转换规范
- [ ] **已了解技能系统**：理解技能如何被触发、声明、评估和激活
- [ ] **已读现有技能**：至少阅读过 3 个现有技能（如 `crud-development`, `json-serialization`, `data-permission`）
- [ ] **已明确技能范围**：技能应该解决什么问题，涵盖哪些触发词
- [ ] **已找到参考代码**：该技能对应的项目中的参考代码或最佳实践

---

## 第 1 步：分析与规划（规划阶段）

### 1.1 定义技能属性

在创建 SKILL.md 前，先回答以下问题：

**技能名称**（kebab-case）：
```
示例：add-skill, json-serialization, crud-development
规则：全小写，单词用横线连接，不包含下划线
```

**技能描述**（技能触发的核心关键词）：
```
示例：
描述：当需要为框架增加新技能、为新的模块功能编写技能文档时自动使用此 Skill。

触发场景：
- 需要为新模块添加技能
- 需要为新功能编写技能文档

触发词：添加技能、创建技能、新技能、技能开发
```

**技能类别**（技术领域）：
```
后端：CRUD、API、数据库、注解、工具类、错误处理、权限、安全、数据权限、多租户
跨模块：ruoyi-api 契约层（UserService/WorkflowService 等接口 + DTO/Model/Event）
方向能力：AI（ruoyi-ai）、工作流（Warm-Flow）、任务调度（SnailJob）、MQTT、ES、消息推送
前端（生成器产物）：Vue（Element Plus）/ React（Ant Design Pro），位于仓库内 frontend/plus-ui/ 目录
跨领域：架构、集成、测试、性能、国际化、翻译/JSON 增强
```

**关联参考代码**（项目中的真实例子）：
```
本仓库（org.dromara 后端 + 代码生成器模板）：
- backend/java/ruoyi-modules/ruoyi-system/src/main/java/org/dromara/system/  （系统管理，重数据权限 + MPJ）
- backend/java/ruoyi-modules/ruoyi-demo/src/main/java/org/dromara/demo/      （示例模块，CRUD 范本，含 MCP 示例）
- backend/java/ruoyi-modules/ruoyi-gen/src/main/resources/fm/                （★ 代码生成器 FreeMarker 模板：vue/ 与 react/ 双栈）

跨模块契约层：
- backend/java/ruoyi-api/ruoyi-api-system/    （UserService/DeptService/OssService... 接口 + DTO/Model）
- backend/java/ruoyi-api/ruoyi-api-workflow/  （WorkflowService + StartProcessDTO/CompleteTaskDTO + ProcessEvent）

注意：前端页面在独立的 plus-ui 仓库，不在本仓库内；本仓库只有 ruoyi-gen 下的 FreeMarker (.ftl) 模板。
```

### 1.2 分析覆盖范围

```
核心知识点：
- 你需要文档化哪些类、方法、配置？
- 需要包含多少个代码示例？
- 覆盖多少个使用场景？

文档量估计：
- 小型技能（工具类）：200-300 行
- 中型技能（功能模块）：400-600 行
- 大型技能（完整流程）：600+ 行

参考数据：
- json-serialization: 约 600 行（中型）
- crud-development: 大型（覆盖 Entity/BO/VO/Service/Mapper/Controller 全链路）
- data-permission: 中型（@DataPermission + @DataColumn）
```

---

## 第 2 步：编写 SKILL.md（实现阶段）

### 2.1 文件结构模板

```markdown
---
name: {技能名称}
description: |
  {详细描述，包括触发场景和触发词}
---

# {技能标题} 指南

## 概述
{简明介绍，1-2 段}

## 核心工具类/API
{主要类和方法列表}

## 使用规范
{最佳实践和规则}

## 常见错误与最佳实践
{正确做法 vs 错误做法对比}

## 实战示例
{3-5 个真实代码例子}

## 常见问题
{FAQ}
```

### 2.2 编写清单

**⚠️ 必须按顺序完成，YAML 头部是第一优先级！**

#### 第一优先级：YAML 头部（必须最先完成）

- [ ] **name 字段**：使用 kebab-case 格式（全小写+横线）
- [ ] **name 字段**：长度为 2-4 个单词，语义清晰
- [ ] **description 第一行**：完整的一句话说明，以"当需要..."或"用于..."开头
- [ ] **description 第一行后**：有空行
- [ ] **触发场景**：至少 3 个具体场景（不是宽泛描述）
- [ ] **触发场景后**：有空行
- [ ] **触发词**：至少 5 个关键词，用顿号或斜杠分隔
- [ ] **YAML 格式**：以 `---` 开始和结束

#### 第二优先级：核心内容

- [ ] **概述部分**：简明扼要说明技能的作用（150-200 字）
- [ ] **核心内容**：包含 3+ 个主要技术点
- [ ] **代码示例**：至少 5 个真实或接近真实的代码片段（从本仓库真实模块提取，禁止凭空编造）
- [ ] **错误对比**：列举 3+ 个常见错误及其正确做法
- [ ] **参考代码**：附带项目中的具体代码位置
- [ ] **复杂性适中**：避免过于基础或过于深入

### 2.3 推荐的内容结构

#### 后端技能示例（CRUD、API 等）

```markdown
## 核心工具类
{MapstructUtils / StringUtils / StreamUtils / QueryBuilder / RedisUtils / DateUtils ...}

## 关键规范
{表格：项目、规范}

## 标准代码模板
### Entity（extends BaseEntity）
### BO / VO（@AutoMapper(target=Entity.class)，implements Serializable）
### Service（IXxxService + XxxServiceImpl，@RequiredArgsConstructor @Service）
### Mapper（extends BaseMapperPlus<Entity, EntityVo>，复杂模块叠加 MPJBaseMapper）
### Controller（extends BaseController，返回 R<T>，@SaCheckPermission）

## 后端使用示例
{3-5 个真实场景，含分页 PageQuery+PageResult、QueryBuilder.lambda 条件构建}

## 前端调用注意事项
{大数字 Long→string、日期范围 params、@Translation ID→名称展示}

## 常见错误
### ✅ 正确做法
### ❌ 常见错误
```

#### 前端/移动端技能示例（生成器模板、组件、设计等）

> 本仓库前端为**代码生成器产物**，模板位于 `backend/java/ruoyi-modules/ruoyi-gen/src/main/resources/fm/{vue|react}/`，运行时页面在独立的 plus-ui 仓库。涉及前端的技能应面向「生成器模板 + 生成产物约定」编写。

```markdown
## 前端栈与模板目录
{gen_table.frontend_type → fm/<type>/ 模板目录：vue（Element Plus）/ react（Ant Design Pro）}

## API / 类型文件约定
{API：listXxx/getXxx/addXxx/updateXxx/delXxx；类型：VO/Form/Query}

## 实战示例
### 场景 1：列表页面（生成器 index.vue.ftl / 产物）
### 场景 2：表单页面
### 场景 3：详情页面

## 常见错误
### ❌ 在 Java 里硬编码前端栈枚举（应只加 fm/<type>/ 目录 + FTL）
### ❌ 未对齐后端路由命名
```

---

## 第 3 步：双系统声明（声明阶段）

> **注意区分**：这一步针对的是**技能（Skill）**的声明。如果你是在创建**命令（Command）**，请参考下方的"3.4 Command 的声明方式"。

### 3.1 在 Hook 中声明（`.claude/hooks/skill-forced-eval.cjs`）

**位置**：技能列表区域

**格式**：
```javascript
- {技能名称}: {触发词，用空格或中文逗号分隔}
```

**示例**：
```javascript
- add-skill: 添加技能、创建技能、新技能、技能开发
- json-serialization: JSON序列化/反序列化/数据转换/JsonUtils/日期格式
```

**修改步骤**：
1. 打开 `.claude/hooks/skill-forced-eval.cjs`
2. 在技能列表中找到合适的插入位置（按字母序或逻辑分组）
3. 添加新一行：`- {技能名}: {触发词}`
4. 保存文件

### 3.2 在 AGENTS.md 中声明

**位置**：`AGENTS.md` 的技能清单表格

**格式**：
```markdown
| \`{技能名}\` | {触发条件（description）} |
```

**示例**：
```markdown
| `add-skill` | 为框架添加新技能、编写技能文档 |
| `json-serialization` | JSON 序列化/反序列化/数据转换/JsonUtils/日期格式/精度/BigDecimal |
```

**修改步骤**：
1. 打开 `AGENTS.md`
2. 找到技能清单表格
3. 在合适位置添加新行
4. 保存文件

### 3.3 验证声明

```bash
# 检查 hook 文件
grep "add-skill" .claude/hooks/skill-forced-eval.cjs

# 检查 AGENTS.md
grep "add-skill" AGENTS.md
```

### 3.4 Command 的声明（仅适用于斜杠命令）

新增 Claude command 时，除了创建 `.claude/commands/xxx.md`，还需要：
1. 在 `.codex/skills/xxx/SKILL.md` 创建对应 skill（加 YAML 头部 + 相同正文）
2. 在 Hook 文件和 AGENTS.md 中声明（同 3.1/3.2）

---

## 第 4 步：Codex 系统同步（同步阶段）

### 4.1 复制到 Codex 目录

本仓库同时支持 Claude Code（`.claude/`）和 Codex（`.codex/`）两个系统，需要保持技能镜像同步。

**步骤**：

1. **创建目录**：
   ```
   .codex/skills/[技能名]/
   ```

2. **复制文件**：
   将 `.claude/skills/[技能名]/SKILL.md` 复制到 `.codex/skills/[技能名]/SKILL.md`

3. **验证一致性**：
   确保两个文件内容完全相同

**示例**（json-serialization）：
```
.claude/skills/json-serialization/SKILL.md
.codex/skills/json-serialization/SKILL.md  （内容完全相同）
```

### 4.2 Command 同步到 Codex

新增/修改 Claude command 时，同步 `.codex/skills/[command名]/SKILL.md`（加 YAML 头部 + 相同正文）。

### 4.3 检查清单

- [ ] `.codex/skills/` 下对应目录已创建
- [ ] Skill：两端文件内容完全相同
- [ ] Command：Codex 文件包含 YAML 头部 + 与 Claude command 一致的正文

> **共存提醒**：本仓库已有 `.claude/agents/`（6 个后端 subagent）。新增技能与它们**共存**，不要覆盖或删除——agents 是后端专项子代理，分场景技能是「细化补充」。

---

## 第 5 步：验证与测试（验证阶段）

### 5.1 完整检查清单

运行以下检查确保技能正确添加：

**文件检查**：
```bash
# 检查 Claude Code 文件存在
ls -la .claude/skills/[技能名]/SKILL.md

# 检查 Codex 文件存在
ls -la .codex/skills/[技能名]/SKILL.md

# 验证文件行数一致（应该完全相同）
wc -l .claude/skills/[技能名]/SKILL.md
wc -l .codex/skills/[技能名]/SKILL.md
```

**声明检查**：
```bash
# 检查 hook 声明
grep -n "[技能名]:" .claude/hooks/skill-forced-eval.cjs

# 检查 AGENTS.md 声明
grep -n "[技能名]" AGENTS.md
```

**内容检查**：
- [ ] **YAML 头部格式正确**（`name:` 使用 kebab-case，`description:` 包含触发场景和触发词）
- [ ] **YAML 头部完整**（至少 3 个触发场景，至少 5 个触发词）
- [ ] **触发场景具体明确**（不是宽泛描述）
- [ ] **触发词包含技术术语**（如类名、注解名、工具类名）
- [ ] 技能描述包含 3+ 个触发场景
- [ ] 至少包含 5 个代码示例
- [ ] 至少包含 3 个错误对比
- [ ] 包含真实项目代码参考（路径指向本仓库真实模块）
- [ ] 没有语法错误或格式问题
- [ ] **无旧版残留**：不出现 `com.ruoyi`、`plus.ruoyi`、DAO 层、`buildQueryWrapper`、`TenantEntity`（默认基类）等

### 5.2 激活测试

在实际使用中，验证技能是否正确激活：

1. **编写包含触发词的提问**：
   ```
   用户提问："我需要添加一个新的支付集成技能"
   ```

2. **验证技能评估**：
   Hook 应该输出：
   ```
   ## 强制技能激活流程

   ### 步骤 1 - 评估（必须在响应中明确展示）

   匹配技能：
   - add-skill: 涉及新技能开发
   ```

3. **验证激活**：
   应该看到 `Skill(add-skill)` 被调用

---

## 实战案例：json-serialization 技能

下面以实际添加 `json-serialization` 技能为例，展示完整流程：

### 步骤 1：分析与规划

**技能属性**：
```
名称：json-serialization
类别：后端通用技能
范围：JSON 序列化、反序列化、大数字处理、日期转换
参考模块：ruoyi-common-json（org.dromara.common.json）
核心工具：JsonUtils、BigNumberSerializer、自定义日期反序列化器
```

### 步骤 2：编写 SKILL.md

创建文件：`.claude/skills/json-serialization/SKILL.md`

包含以下部分：
- 概述（JSON 处理框架）
- 核心工具类（JsonUtils 所有方法）
- 自动配置详解（大数字处理、日期格式化）
- 后端使用示例（5 个场景）
- 前端调用注意（大数字 Long→string 精度问题）
- 常见错误与最佳实践

**最终行数**：约 600 行

### 步骤 3：声明技能

**在 hook 中添加**（`.claude/hooks/skill-forced-eval.cjs`）：
```javascript
- json-serialization: JSON序列化/反序列化/数据转换/JsonUtils/日期格式/精度/BigDecimal/Long/类型转换/JSON验证
```

**在 AGENTS.md 中添加**：
```markdown
| `json-serialization` | JSON 序列化/反序列化/数据转换/JsonUtils/日期格式/精度/BigDecimal/Long/类型转换/JSON 验证 |
```

### 步骤 4：Codex 同步

复制文件：
```
.codex/skills/json-serialization/SKILL.md
```

验证：两个文件内容完全相同

### 步骤 5：验证

所有检查通过：
- ✅ 文件存在于两个系统
- ✅ Hook 和 AGENTS.md 均已声明
- ✅ 内容符合规范（包名 org.dromara，无 DAO 残留）
- ✅ 可被正确激活

---

## 修改现有技能（维护流程）

> **核心原则**：`.claude/skills/` 是主目录（source of truth），`.codex/skills/` 是镜像。
> 所有修改都在 `.claude/skills/` 中进行，然后同步到 `.codex/skills/`。

### 场景 1：修改技能内容（最常见）

当需要修改现有技能的文档内容（如新增规则、修正示例、补充场景）：

**步骤**：

1. **在 `.claude/skills/[技能名]/SKILL.md` 中修改内容**
2. **同步到 Codex**：
   ```bash
   cp .claude/skills/[技能名]/SKILL.md .codex/skills/[技能名]/SKILL.md
   ```
3. **验证一致性**：
   ```bash
   diff .claude/skills/[技能名]/SKILL.md .codex/skills/[技能名]/SKILL.md
   ```
   输出应为空（无差异）

### 场景 2：修改触发词或触发场景

当需要修改技能的 YAML 头部（触发词、触发场景、描述）：

**步骤**：

1. **修改 SKILL.md 的 YAML 头部**
2. **同步修改 Hook 文件**（`.claude/hooks/skill-forced-eval.cjs`）中对应的触发词行
3. **同步修改 AGENTS.md** 中对应的技能描述行
4. **复制到 Codex**：
   ```bash
   cp .claude/skills/[技能名]/SKILL.md .codex/skills/[技能名]/SKILL.md
   ```
5. **验证三处一致**：
   ```bash
   # 验证文件同步
   diff .claude/skills/[技能名]/SKILL.md .codex/skills/[技能名]/SKILL.md
   # 验证 Hook 声明
   grep "[技能名]" .claude/hooks/skill-forced-eval.cjs
   # 验证 AGENTS.md 声明
   grep "[技能名]" AGENTS.md
   ```

### 场景 3：重命名技能

当需要重命名技能（如 `old-name` → `new-name`）：

**步骤**：

1. **创建新目录并移动文件**：
   ```bash
   # Claude Code
   mkdir -p .claude/skills/[新名称]
   mv .claude/skills/[旧名称]/SKILL.md .claude/skills/[新名称]/SKILL.md
   rmdir .claude/skills/[旧名称]

   # Codex
   mkdir -p .codex/skills/[新名称]
   cp .claude/skills/[新名称]/SKILL.md .codex/skills/[新名称]/SKILL.md
   rm -rf .codex/skills/[旧名称]
   ```
2. **修改 SKILL.md 中 YAML 头部的 `name` 字段**
3. **修改 Hook 文件**（`.claude/hooks/skill-forced-eval.cjs`）中的技能名
4. **修改 AGENTS.md** 中的技能名
5. **全局搜索旧名称**，确保无遗漏引用：
   ```bash
   grep -r "[旧名称]" .claude/ .codex/ AGENTS.md CLAUDE.md
   ```

### 场景 4：删除技能

当需要删除不再需要的技能：

**步骤**：

1. **删除文件**：
   ```bash
   rm -rf .claude/skills/[技能名]
   rm -rf .codex/skills/[技能名]
   ```
2. **从 Hook 文件中移除**对应的触发词行
3. **从 AGENTS.md 中移除**对应的技能行
4. **全局搜索确认无遗漏引用**

### 场景 5：修改 Claude Command

修改 `.claude/commands/xxx.md` 后，同步正文到 `.codex/skills/xxx/SKILL.md`（保留其 YAML 头部）。

### 修改后的检查清单

每次修改现有技能后，必须通过以下检查：

- [ ] `.claude/skills/[技能名]/SKILL.md` 已修改
- [ ] `.codex/skills/[技能名]/SKILL.md` 已同步（`diff` 无差异）
- [ ] 如果修改了触发词：Hook 文件和 AGENTS.md 已同步更新
- [ ] 如果重命名：旧名称已全局搜索确认无遗漏

---

## 常见陷阱与解决方案

### 陷阱 0：YAML 头部格式错误（最常见！）

**症状**：技能无法被正确识别或激活，Hook 评估时找不到该技能

**原因**：
- `name` 使用了下划线或驼峰命名
- `description` 过于简短，缺少触发场景或触发词
- 触发词数量不足（少于 5 个）
- 缺少必要的空行
- 触发场景描述过于宽泛

**解决**：
1. 严格按照"YAML 头部强制规范"章节的要求编写
2. 使用本文档提供的正确示例作为模板
3. 完成"YAML 头部验证清单"中的所有检查项
4. 参考现有技能（如 `json-serialization`）的 YAML 头部格式

**正确示例**：
```yaml
---
name: data-permission
description: |
  当需要实现行级数据权限、部门数据隔离时自动使用此 Skill。

  触发场景：
  - 需要为业务模块添加 @DataPermission 行级过滤
  - 需要配置部门级数据隔离
  - 需要扩展自定义数据权限类型
  - 需要排查数据权限不生效问题

  触发词：数据权限、@DataPermission、@DataColumn、DataScope、行级权限、数据隔离、部门权限、本人权限、权限过滤
---
```

### 陷阱 1：新增 Command 时忘记在 Codex 创建对应 Skill

**解决**：在 `.codex/skills/[command名]/SKILL.md` 中创建带 YAML 头部的对应文件

### 陷阱 2：遗漏某个系统的声明

**症状**：技能在 Claude Code 中可用，但 Codex 中无法激活（反之亦然）

**原因**：只在 hook 或 AGENTS.md 中声明了一次，另一个系统没有同步

**解决**：
- 同时修改 `.claude/hooks/skill-forced-eval.cjs` 和 `AGENTS.md`
- 两处都需要添加该技能

### 陷阱 3：忘记复制到 Codex 目录

**解决**：`cp -r .claude/skills/[技能名] .codex/skills/`

### 陷阱 4：触发词设置过于宽泛

**症状**：技能被过度激活，在不相关的场景中被触发

**原因**：触发词选择不当，例如使用"开发"而不是更具体的"CRUD 开发"

**解决**：
- 使用具体、专业的触发词
- 避免过于通用的词汇
- 参考现有技能的触发词风格

### 陷阱 5：文档内容过于冗长或过于简短

**症状**：技能无法提供实际帮助

**原因**：文档要么内容不足，要么冗长无焦点

**解决**：
- 瞄准 400-600 行的中等规模
- 包含 5+ 个真实代码示例
- 明确区分"最佳实践"vs"常见错误"

### 陷阱 6：技能覆盖范围与现有技能重叠

**症状**：多个技能处理同一问题，造成混淆

**原因**：未充分检查现有技能列表

**解决**：
- 在创建前阅读现有技能的 description
- 与相关技能进行边界划分
- 必要时在文档中说明与其他技能的关系

### 陷阱 7：套用了非本框架的概念（6.x 专属红线）

**症状**：技能里写了 `com.ruoyi` / `plus.ruoyi` 包名、引用了独立 DAO 层、用 `DAO.buildQueryWrapper()` 构建条件、Entity 继承了 `TenantEntity`

**原因**：照搬了原版 RuoYi、衍生版或多租户版的概念

**解决**：
- 包名一律 `org.dromara.*`
- 没有 DAO 层：查询条件在 Service 里用 `QueryBuilder.lambda(Entity.class)` / `LambdaQueryWrapper` 构建
- Entity 默认继承 `BaseEntity`（多租户场景才另议，不作默认）
- 对象转换用 `MapstructUtils.convert`，不要手写 `BeanUtils.copyProperties`

---

## 技能开发清单（最终版）

在提交新技能前，请确认以下所有项目：

### 🔴 第一优先级：YAML 头部（必须最先检查）

- [ ] `name` 使用 kebab-case 格式（全小写+横线）
- [ ] `name` 长度为 2-4 个单词
- [ ] `name` 语义清晰，不过于宽泛
- [ ] `description` 第一行是完整的一句话说明
- [ ] 第一行以"当需要..."或"用于..."开头
- [ ] 第一行后有空行
- [ ] 包含"触发场景："标题
- [ ] 至少有 3 个具体的触发场景
- [ ] 每个触发场景都具体明确（不是宽泛描述）
- [ ] 触发场景后有空行
- [ ] 包含"触发词："标题
- [ ] 至少有 5 个触发词
- [ ] 触发词用中文顿号（、）或斜杠（/）分隔
- [ ] 触发词包含技术术语和常用表达
- [ ] YAML 头部以 `---` 开始和结束

### 规划阶段
- [ ] 技能名称已确定（kebab-case）
- [ ] 触发词列表已确定（3+ 个）
- [ ] 覆盖范围已明确（不与现有技能重叠）
- [ ] 参考代码已找到（指向本仓库真实模块，如 ruoyi-system / ruoyi-demo / ruoyi-gen）

### 实现阶段
- [ ] SKILL.md 已创建在 `.claude/skills/`
- [ ] YAML 头部格式正确
- [ ] 文档包含 5+ 代码示例
- [ ] 文档包含 3+ 错误对比
- [ ] 文档长度 400-600+ 行
- [ ] 所有代码片段使用 `org.dromara.*` 包名、三层架构、MapstructUtils，无旧版残留

### 声明阶段
- [ ] Hook 文件已更新（`.claude/hooks/skill-forced-eval.cjs`）
- [ ] AGENTS.md 已更新（技能表格）
- [ ] 两处声明的触发词一致

### 同步阶段
- [ ] 文件已复制到 `.codex/skills/`
- [ ] 两个系统的文件内容完全相同
- [ ] 文件行数验证无误
- [ ] 未覆盖 `.claude/agents/` 6 个后端 subagent

### 验证阶段
- [ ] 文件检查通过（存在且完整）
- [ ] 声明检查通过（hook 和 AGENTS.md）
- [ ] 内容检查通过（格式、完整性、无旧版残留）
- [ ] 激活测试通过（能被正确识别和调用）

### 维护阶段（修改现有技能时）
- [ ] 修改在 `.claude/skills/` 主目录中完成
- [ ] 已同步到 `.codex/skills/`（`diff` 无差异）
- [ ] 如修改触发词：Hook 文件已更新
- [ ] 如修改触发词：AGENTS.md 已更新
- [ ] 如重命名/删除：旧名称已全局搜索确认无遗漏

---

## 快速参考

### 快速创建命令

```bash
# 1. 创建 Claude Code 目录和文件
mkdir -p .claude/skills/[技能名]
touch .claude/skills/[技能名]/SKILL.md

# 2. 复制到 Codex（创建文件后执行）
mkdir -p .codex/skills/[技能名]
cp .claude/skills/[技能名]/SKILL.md .codex/skills/[技能名]/SKILL.md

# 3. 验证双系统一致性
diff .claude/skills/[技能名]/SKILL.md .codex/skills/[技能名]/SKILL.md

# 4. 确认声明
grep "[技能名]" .claude/hooks/skill-forced-eval.cjs
grep "[技能名]" AGENTS.md
```

### 快速同步命令（修改现有技能后）

```bash
# 1. 同步到 Codex
cp .claude/skills/[技能名]/SKILL.md .codex/skills/[技能名]/SKILL.md

# 2. 验证一致性（输出应为空）
diff .claude/skills/[技能名]/SKILL.md .codex/skills/[技能名]/SKILL.md
```

### 文件大小参考

| 技能类型 | 预期行数 | 示例 |
|---------|---------|------|
| 小型（工具类） | 200-300 | StringUtils, DateUtils |
| 中型（功能模块） | 400-600 | json-serialization, data-permission |
| 大型（完整流程） | 600+ | crud-development, security-auth |

### 框架核心约定速查（写技能时随手对照）

| 维度 | 本项目（base-dev-framework6-java）做法 |
|------|------------------------|
| 包名前缀 | `org.dromara.*` |
| 分层 | Controller → Service(I + Impl) → Mapper（**无 DAO**） |
| Entity 基类 | `BaseEntity` |
| Mapper 基类 | `BaseMapperPlus<Entity, EntityVo>`（复杂模块 + `MPJBaseMapper`） |
| 对象转换 | `MapstructUtils.convert(bo, Entity.class)` + `@AutoMapper` |
| 查询构建 | `QueryBuilder.lambda(Entity.class)` / `LambdaQueryWrapper`，条件辅助 `eqIfText/likeIfText/eqIfPresent/inIfNotEmpty/betweenParams` |
| 分页 | `PageQuery` + `PageResult`；`mapper.selectVoPage(pageQuery.build(), lqw)` |
| 响应 | `R<T>` / `R<Void>`；分页 `PageResult` |
| 认证授权 | Sa-Token，`@SaCheckPermission("${module}:${business}:${action}")` |
| 数据权限 | `@DataPermission` + `@DataColumn` |
| 逻辑删除/乐观锁 | `@TableLogic`（delFlag）/ `@Version` |
| 翻译展示 | `TranslationInterface<T>` + `@TranslationType` + VO `@Translation` |
| 跨模块调用 | 走 `ruoyi-api` 契约接口，不直接 import 别的业务模块实现 |
| 前端 | 独立 plus-ui 仓库；本仓库仅 `ruoyi-gen/.../fm/{vue,react}/` 生成器模板 |

---

## 下一步

技能创建完成后：

1. **集成到项目**：将技能文件提交到项目仓库
2. **更新文档**：在 AGENTS.md / CLAUDE.md 中提及新技能
3. **收集反馈**：在实际使用中优化和完善技能文档
4. **维护更新**：随内部框架演进，定期更新技能文档
