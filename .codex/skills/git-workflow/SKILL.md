---
name: git-workflow
description: |
  当需要进行 Git 版本控制操作时自动使用此 Skill。

  触发场景：
  - 提交代码
  - 创建/合并分支
  - 查看提交历史
  - 解决冲突
  - 回滚代码

  触发词：git、提交、commit、分支、合并、push、pull、冲突、回滚、版本、历史
---

# Git 工作流指南

## ⚠️ 本项目提交规范（必须遵守）

### 核心原则

0. 🔴 **强制遵循 Git Flow 分支规范**：创建/合并分支前先读 `docs/Git Flow 开发协作简易指南.md`，分支模型与合并红线按指南执行（`main` 只接受 `release/*` 与 `hotfix/*`；**严禁** `dev` 直接合并 `main`；`hotfix` 必须反向同步回 `dev`）。
1. **只提交当前会话的改动**：只 `git add` 当前聊天中修改或新增的文件
2. **不提交配置文件**：排除 `.env*`、`application*.yml`、`langchain4j.yml` 等配置
3. **默认只提交到本地**：执行 `git add` + `git commit`，**不自动 push**
4. **明确指定才推送**：只有用户明确说"推送"、"push"、"提交到远程"时才执行 `git push`

### 提交信息格式

```
<平台前缀> <type>(<scope>): <subject>
```

**平台前缀**（必须）：

| 前缀 | 说明 | 目录判断 |
|------|------|---------|
| `后端` | 只修改后端代码 | `ruoyi-*/**` |
| `前端` | 只修改 PC 前端 | `plus-ui/**` |
| `移动端` | 只修改移动端 | `plus-uniapp/**`、`plus-app/**` |
| `后端&前端` | 同时修改后端和前端 | 两者都有改动 |
| `后端&移动端` | 同时修改后端和移动端 | 两者都有改动 |
| `前端&移动端` | 同时修改前端和移动端 | 两者都有改动 |
| `全栈` | 后端+前端+移动端都有改动 | 三者都有改动 |

### 提交示例

```bash
# 只修改后端
后端 feat(business): 新增优惠券管理功能

# 只修改前端
前端 fix(user): 修复用户列表分页问题

# 只修改移动端
移动端 feat(home): 新增首页轮播图

# 后端+前端一起改
后端&前端 feat(ad): 新增广告管理模块

# 后端+移动端
后端&移动端 fix(order): 修复订单创建接口

# 全栈开发
全栈 feat(payment): 新增支付功能
```

### 提交流程

```bash
# 1. 查看当前改动
git status

# 2. 只添加当前会话修改的业务文件（排除配置）
git add ruoyi-modules/ruoyi-business/src/main/java/plus/ruoyi/business/xxx/
git add plus-ui/src/views/business/xxx/
# 或者添加具体文件
git add path/to/file1.java path/to/file2.vue

# 3. 提交到本地（不 push！）
git commit -m "后端&前端 feat(xxx): 新增xxx功能"

# 4. 只有用户明确要求时才推送
# git push  # ← 用户说"推送"时才执行
```

### 不要提交的文件

```bash
# ❌ 配置文件（绝对不提交）
plus-ui/env/.env.*
plus-uniapp/env/.env.*
plus-app/env/.env.*
ruoyi-admin/src/main/resources/application.yml
ruoyi-admin/src/main/resources/application-*.yml
ruoyi-common/**/resources/*.yml

# ❌ IDE 配置
.idea/
.vscode/
*.iml

# ❌ 本地临时文件
*.log
node_modules/
target/
dist/
```

### 判断平台前缀的方法

```bash
# 查看当前改动涉及的目录
git status --short

# 根据路径判断平台：
# M ruoyi-modules/...        → 后端
# M plus-ui/...              → 前端
# M plus-uniapp/...          → 移动端
# M plus-app/...             → 移动端
```

---

## 提交类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| feat | 新功能 | `后端 feat(business): 新增用户反馈功能` |
| fix | 修复Bug | `前端 fix(mall): 修复订单状态显示错误` |
| docs | 文档更新 | `docs(readme): 更新安装说明` |
| style | 代码格式 | `后端 style: 格式化代码` |
| refactor | 重构 | `后端 refactor(user): 重构用户模块` |
| perf | 性能优化 | `后端 perf(query): 优化查询性能` |
| test | 测试 | `后端 test: 添加单元测试` |
| chore | 构建/工具 | `chore: 更新依赖` |

---

## 常用命令

### 基础操作

```bash
# 查看状态
git status

# 查看改动
git diff
git diff --staged  # 已暂存的改动

# 添加文件
git add .          # 添加所有（谨慎使用！）
git add <file>     # 添加指定文件（推荐）

# 提交
git commit -m "提交信息"

# 推送（需用户明确要求）
git push
git push -u origin <branch>  # 首次推送并设置上游
```

### 分支操作

```bash
# 查看分支
git branch         # 本地分支
git branch -r      # 远程分支
git branch -a      # 所有分支

# 创建分支
git branch <name>
git checkout -b <name>  # 创建并切换

# 切换分支
git checkout <name>
git switch <name>

# 合并分支
git merge <name>

# 删除分支
git branch -d <name>     # 删除本地
git push origin -d <name>  # 删除远程
```

### 历史查看

```bash
# 查看提交历史
git log
git log --oneline
git log --oneline -10  # 最近10条

# 查看某文件历史
git log --follow <file>

# 查看某次提交的内容
git show <commit-id>
```

### 撤销操作

```bash
# 撤销工作区修改
git checkout -- <file>
git restore <file>

# 撤销暂存
git reset HEAD <file>
git restore --staged <file>

# 撤销提交（保留修改）
git reset --soft HEAD^

# 撤销提交（丢弃修改）
git reset --hard HEAD^

# 回滚到某个提交
git reset --hard <commit-id>
```

---

## 🔴 远程 Git 操作优先用 Sigil（检测到才启用，没装则无感回退）

> 需要远程认证的 git 操作（`push` / `clone` / 推送后远端核对），**本会话检测到 Sigil 就优先走它**（凭据由保险库注入，明文不外泄、不落 `.git/config`）；**Sigil 没装就照常 `git push`，流程不受影响**。

### 🔴 三条铁律

1. **零明文**：任何平台的 git 推送 / 建仓 / API 一律走 Sigil，**永不**手拼 `https://user:TOKEN@host` 或明文传 token（明文会随 `.git/config` 同步到云盘泄露）。
2. **username 别用默认**：`git_push` 推 **Gitee / GitCode** 时 `username` 必传该平台真实登录账号，用默认 `x-access-token` 会认证失败；GitHub 可用默认 `x-access-token`。
3. **失败即停**：Sigil 报错（锁库 / 缺凭据 / 能力未启用）→ 停下提示用户处理，**绝不**回退明文 token。

### 用法

- **检测**：本会话能 `ToolSearch` 到 `mcp__sigil__git_push` → 可用；查不到 → 回退普通 `git push`，不报错不卡流程。
- **选凭据**：先 `mcp__sigil__list_credentials` 按平台（`gitee_token` / `gitcode_token` / `github_token`）查到对应 `credential_name`，**不写死猜**。
- **推送**：`mcp__sigil__git_push(repo_path=<仓库绝对路径>, remote=<远程名>, branch=<分支>, credential_name=<查到的>, username=<Gitee/GitCode 传真实账号 · GitHub 用 x-access-token>)`。多 remote 逐个推。
- **建仓 / 改描述 / 查提交**：`mcp__sigil__{平台}_repo_create`（🔴 `private: true`，绝不建公开仓）/ `mcp__sigil__{平台}_repo_update` / `mcp__sigil__{平台}_commits_list`。
- **失败**：按 Sigil 错误前缀处置（解锁金库 / 补凭据 / 启用能力），绝不落明文 token。

## 分支策略（遵循 Git Flow 指南）

> 分支模型、命名、合并去向**强制**遵循 `docs/Git Flow 开发协作简易指南.md`。

### 主要分支

| 分支 | 命名 | 来源 | 合并去向 | 说明 |
|------|------|------|---------|------|
| main | `main` | - | - | 生产基线，只接受 `release/*` 与 `hotfix/*` 的合并，合并后必须打 Tag（如 `v1.2.0`） |
| dev | `dev` | main | release | 开发主线，接受 `feat/*`、`hotfix/*`、`release/*` 的合并 |
| release | `release/<版本>` | dev | main & dev | 预发/冻结分支，验证通过后合并 main 与 dev，立即删除 |
| feature | `feat/<禅道ID_描述_代号>` | dev | dev | 功能开发分支，合并回 dev 后删除 |
| hotfix | `hotfix/<版本_代号>` | main | main & dev & release | 线上紧急修复，必须反向同步回 dev |
| customer | `cust/<name>` | main 的稳定 Tag | - | 客户定制分支，通用功能重构/配置化后回流 dev |

### 工作流程

```bash
# 1. 从 dev 创建功能分支
git checkout dev
git pull
git checkout -b feat/<禅道ID_描述_代号>

# 2. 开发并提交（只提交当前会话改动的业务文件）
git add ruoyi-modules/ruoyi-business/src/main/java/org/dromara/business/feedback/
git commit -m "后端 feat(business): 新增用户反馈功能 [Bug 1111]"

# 3. 用户明确要求时才推送到远程
git push -u origin feat/<禅道ID_描述_代号>

# 4. 创建 Pull Request 合并到 dev（至少 1 人 Review）

# 5. 合并后删除功能分支
git checkout dev
git pull
git branch -d feat/<禅道ID_描述_代号>
```

---

## 冲突解决

### 合并冲突

```bash
# 1. 拉取最新代码
git pull

# 2. 如果有冲突，Git 会提示
# Auto-merging xxx.java
# CONFLICT (content): Merge conflict in xxx.java

# 3. 打开冲突文件，手动解决
# <<<<<<< HEAD
# 当前分支的代码
# =======
# 要合并的代码
# >>>>>>> feature/xxx

# 4. 解决后添加并提交
git add .
git commit -m "后端 fix: 解决合并冲突"
```

### 变基冲突

```bash
# 1. 变基
git rebase develop

# 2. 如果有冲突，解决后
git add .
git rebase --continue

# 3. 放弃变基
git rebase --abort
```

---

## 实用技巧

### 暂存修改

```bash
# 暂存当前修改
git stash

# 查看暂存列表
git stash list

# 恢复暂存
git stash pop        # 恢复并删除
git stash apply      # 恢复但保留

# 删除暂存
git stash drop
git stash clear      # 清空所有
```

### 修改提交

```bash
# 修改最后一次提交信息
git commit --amend -m "新的提交信息"

# 追加到最后一次提交
git add .
git commit --amend --no-edit
```

### Cherry-pick

```bash
# 把某个提交应用到当前分支
git cherry-pick <commit-id>
```

### 查看某人的提交

```bash
git log --author="作者名"
```

---

## 注意事项

### 禁止操作

1. **不要强制推送到主分支**
   ```bash
   # ❌ 禁止
   git push --force origin master
   ```

2. **不要在主分支直接开发**
   ```bash
   # ❌ 禁止
   git checkout master
   # 直接修改代码...
   ```

3. **不要提交敏感信息和配置文件**
   ```bash
   # ❌ 禁止提交
   .env
   .env.development
   .env.production
   application.yml
   application-dev.yml
   credentials.json
   password.txt
   ```

4. **不要自动 push（除非用户明确要求）**
   ```bash
   # ❌ 默认不执行
   git push

   # ✅ 只有用户说"推送到远程"时才执行
   git push
   ```

### 最佳实践

1. **只提交当前会话改动**：不要 `git add .`，精确添加修改的文件
2. **排除配置文件**：配置文件包含本地环境信息，不应提交
3. **清晰的提交信息**：包含平台前缀 + 类型 + 范围 + 描述
4. **默认只本地提交**：`git add` + `git commit`，不自动 push
5. **频繁小步提交**：便于追踪和回滚
6. **Code Review**：通过 PR 合并代码
