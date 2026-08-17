---
name: collaborating-with-codex
description: |
  与 OpenAI Codex CLI 协同开发。优先用官方插件 codex-plugin-cc 的斜杠命令；未安装时回退到框架内置 Python 桥接脚本，并提示用户安装。

  触发场景：
  - 需要算法实现或复杂逻辑分析
  - 需要代码审查和 Bug 分析
  - 需要生成 Unified Diff 补丁
  - 用户明确要求使用 Codex 协作
  - 复杂后端逻辑的原型设计
  - 需要安装、了解或使用 codex-plugin-cc 官方插件

  触发词：Codex、协作、多模型、原型、Diff、算法分析、代码审查、codex协同、codex-plugin-cc、codex插件、官方插件、codex review、codex rescue、adversarial-review、review-gate

  前置要求：
  - 已安装 Codex CLI (npm install -g @openai/codex)
  - 已配置 OpenAI API Key（或 ChatGPT 订阅登录）
---

# 与 Codex CLI 协同开发

> 提供两条路径：
> **A. 官方插件 codex-plugin-cc**（OpenAI 官方维护，斜杠命令、子代理、Stop Hook 自动审查）—— 适合人工交互
> **B. 框架内置 Python 桥接脚本**（JSON 输出、严格沙箱、参数全）—— 适合 Skill / 命令内编排
>
> **激活时必须先执行启动探测**，根据是否已装官方插件分支决策。

---

## 🔴 启动探测（每次激活时执行，强制）

每次本技能被激活，**Claude 必须先执行**以下 Bash 探测（约 50–100ms，可忽略）：

```bash
PLUGINS_FILE="$HOME/.claude/plugins/installed_plugins.json"
SUPPRESS=".claude/skills/collaborating-with-codex/.suppress-install-hint"

if [ -f "$SUPPRESS" ]; then
  echo "SUPPRESSED"
elif [ -f "$PLUGINS_FILE" ] && grep -q '"codex@' "$PLUGINS_FILE"; then
  echo "INSTALLED"
else
  echo "NOT_INSTALLED"
fi
```

**根据结果选择行为**：

| 探测结果 | Claude 行为 |
|---------|-------------|
| `INSTALLED` | 优先建议用户用 `/codex:review`、`/codex:rescue` 等官方命令；仅在需要 JSON 输出 / 严格沙箱 / 图片附加 / profile 切换时用桥接脚本；**不输出**安装提示 |
| `NOT_INSTALLED` | 用桥接脚本完成本次请求，**在响应末尾追加一次安装提示**（见下方模板） |
| `SUPPRESSED` | 用桥接脚本，**不输出**安装提示（用户已主动关闭提示） |

**单会话不重复**：本会话内探测一次即可，**安装提示最多输出一次**。

---

## 📦 安装提示模板（仅 NOT_INSTALLED 时，且每会话最多一次）

> 以下文本在响应末尾以独立块输出，逐字采用：

```
💡 检测到你未安装 codex-plugin-cc 官方插件（OpenAI 官方维护，提供 /codex:review、/codex:rescue 等斜杠命令，比手动调用桥接脚本更顺手）。

四步安装（在 Claude Code 输入框依次敲）：
  /plugin marketplace add openai/codex-plugin-cc
  /plugin install codex@openai-codex
  /reload-plugins
  /codex:setup

可选：开启写完自动审查 → /codex:setup --enable-review-gate
不想再看到此提示：touch .claude/skills/collaborating-with-codex/.suppress-install-hint
```

---

## 🔀 两种调用方式对照

| 场景 | 推荐方式 | 命令 / 参数 |
|------|---------|-----------|
| 人工日常代码审查 | A 官方插件 | `/codex:review`（可加 `--base main`、`--background`） |
| 对抗式审查 | A 官方插件 | `/codex:adversarial-review` |
| 完整任务委派 | A 官方插件 | `/codex:rescue "<任务描述>"` |
| 后台任务管理 | A 官方插件 | `/codex:status`、`/codex:result`、`/codex:cancel` |
| 写完代码自动审查 | A 官方插件 | `/codex:setup --enable-review-gate` |
| Skill / 命令内程序化调用 | B 桥接脚本 | JSON 输出便于解析 |
| 严格 read-only 沙箱 | B 桥接脚本 | 默认 `--sandbox read-only` |
| 附加图片输入 | B 桥接脚本 | `--image path1,path2` |
| 多 profile 切换 | B 桥接脚本 | `--profile <name>` |
| 显式控制 SESSION_ID | B 桥接脚本 | `--SESSION_ID <uuid>` |

---

# A 方案：官方插件 codex-plugin-cc

## 安装

四步装完（同上方"安装提示模板"）：

```
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup
```

如果 `/codex:setup` 提示缺 Codex CLI 或未登录，按提示执行：

```bash
!npm install -g @openai/codex
!codex login
```

> `!` 前缀让命令在 Claude Code 当前会话执行，免切终端。

## 常用命令

| 命令 | 用途 |
|------|------|
| `/codex:review` | 普通代码审查（支持 `--base <ref>`、`--wait`、`--background`） |
| `/codex:adversarial-review` | 对抗式审查（更挑刺，压力测试假设） |
| `/codex:rescue "<任务>"` | 把整个任务委派给 Codex 子代理 |
| `/codex:status` | 查看运行/最近的后台任务 |
| `/codex:result` | 查看后台任务输出与 SESSION_ID |
| `/codex:cancel` | 取消后台任务 |
| `/codex:setup` | 自检安装 / 认证 |
| `/codex:setup --enable-review-gate` | 启用 Stop Hook：Claude 每次写完代码自动让 Codex 审一遍 |
| `/codex:setup --disable-review-gate` | 关闭 Stop Hook |

更多见：[github.com/openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc)

---

# B 方案：框架内置 Python 桥接脚本

> 通过 `codex_bridge.py` 调用 Codex CLI，获取 JSON 结构化输出，适合 Skill / 自动化命令内调用。

## 快速开始

```bash
# 相对路径（推荐，在项目根目录执行）
python .claude/skills/collaborating-with-codex/scripts/codex_bridge.py --cd . --PROMPT "Your task"
```

**输出**: JSON 格式，包含 `success`、`SESSION_ID`、`agent_messages` 和可选的 `error`。

## 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--PROMPT` | str | ✅ | - | 发送给 Codex 的任务指令（使用英语） |
| `--cd` | Path | ✅ | - | 工作目录根路径 |
| `--sandbox` | Literal | ❌ | `read-only` | 沙箱策略：`read-only`/`workspace-write`/`danger-full-access` |
| `--SESSION_ID` | UUID | ❌ | `None` | 会话 ID（继续之前的对话） |
| `--skip-git-repo-check` | bool | ❌ | `True` | 允许在非 Git 仓库运行 |
| `--return-all-messages` | bool | ❌ | `False` | 返回完整推理信息 |
| `--image` | List[Path] | ❌ | `None` | 附加图片文件到提示词 |
| `--model` | str | ❌ | `None` | 指定模型（仅用户明确要求时使用） |
| `--yolo` | bool | ❌ | `False` | 跳过所有审批与沙箱限制（危险） |

## 使用模式

### 1. 基础调用（只读模式）

```bash
python .claude/skills/collaborating-with-codex/scripts/codex_bridge.py \
  --cd . \
  --PROMPT "Analyze the authentication flow in the login module"
```

### 2. 多轮会话

**始终保存 SESSION_ID** 用于后续对话：

```bash
# 第一轮：分析代码
python .claude/skills/collaborating-with-codex/scripts/codex_bridge.py \
  --cd "/project" \
  --PROMPT "Analyze the AdServiceImpl class"

# 后续轮次：使用 SESSION_ID 继续
python .claude/skills/collaborating-with-codex/scripts/codex_bridge.py \
  --cd "/project" \
  --SESSION_ID "uuid-from-previous-response" \
  --PROMPT "Now write unit tests for the add method"
```

### 3. 获取 Unified Diff 补丁

```bash
python .claude/skills/collaborating-with-codex/scripts/codex_bridge.py \
  --cd "/project" \
  --PROMPT "Generate a unified diff to add logging to AdServiceImpl. OUTPUT: Unified Diff Patch ONLY."
```

### 4. 调试模式（返回完整信息）

```bash
python .claude/skills/collaborating-with-codex/scripts/codex_bridge.py \
  --cd "/project" \
  --PROMPT "Debug this error: NullPointerException in line 42" \
  --return-all-messages
```

## 返回值结构

**成功时：**
```json
{
  "success": true,
  "SESSION_ID": "550e8400-e29b-41d4-a716-446655440000",
  "agent_messages": "模型回复内容..."
}
```

**失败时：**
```json
{
  "success": false,
  "error": "错误信息描述"
}
```

## 协作工作流

### 推荐场景

| 场景 | 说明 |
|------|------|
| **后端逻辑分析** | Codex 擅长复杂算法和后端逻辑 |
| **代码审查** | 获取代码质量和潜在问题的反馈 |
| **Debug 分析** | 利用其强大的调试能力定位问题 |
| **原型设计** | 快速获取实现思路（返回 Diff 而非直接修改） |

### 重要约束

1. **只读模式**: 始终使用 `--sandbox read-only`，禁止 Codex 直接修改文件
2. **英语交互**: 与 Codex 交互时使用英语，获得更好效果
3. **Diff 输出**: 在 PROMPT 中明确要求 `OUTPUT: Unified Diff Patch ONLY`
4. **重构代码**: 将 Codex 的输出视为"脏原型"，由 Claude 重构为生产代码
5. **后台运行**: 对于长时间任务，使用 `Run in the background`

## 与本项目的集成

### 典型用例：后端模块分析

```bash
# 分析 Service 层实现
python .claude/skills/collaborating-with-codex/scripts/codex_bridge.py \
  --cd . \
  --PROMPT "Analyze the standard three-layer structure (Controller -> Service -> Mapper extends BaseMapperPlus) in ruoyi-modules/ruoyi-system. Focus on how QueryBuilder.lambda builds queries in the service layer."
```

### 典型用例：代码审查

```bash
# 审查新增的业务模块
python .claude/skills/collaborating-with-codex/scripts/codex_bridge.py \
  --cd "/project" \
  --PROMPT "Review the CouponServiceImpl.java for potential bugs, security issues, and adherence to the project's standard three-layer pattern (Controller -> Service -> Mapper extends BaseMapperPlus). OUTPUT: Review comments with specific line numbers."
```

## 安装前置

```bash
# 安装 Codex CLI
npm install -g @openai/codex

# 配置 API Key（可选，如果未设置环境变量）
codex auth login
```

## 故障排除

| 问题 | 解决方案 |
|------|---------|
| `codex: command not found` | 确保已安装并添加到 PATH |
| `SESSION_ID` 获取失败 | 检查网络连接和 API Key |
| 输出被截断 | 使用 `--return-all-messages` 获取完整信息 |
| Windows 路径问题 | 使用正斜杠 `/` 或双反斜杠 `\\` |
| 启动探测路径不存在 | `~/.claude/plugins/installed_plugins.json` 不存在视为未装，按 NOT_INSTALLED 处理 |
| 反复出现安装提示 | 创建 `.claude/skills/collaborating-with-codex/.suppress-install-hint` 永久关闭 |
