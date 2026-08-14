# 文档索引（AI 协作者导航入口）

> 本目录是知与 SaaS 的**制度性框架**：spec、规范、决策记录都集中在这里。AI 协作者接到任何任务，先按「任务类型」查下表定位要读哪份规范。
>
> **第一入口永远是根目录的 [`AGENTS.md`](../AGENTS.md)**（开发契约 + 全流程）；本目录是契约引用的细则。

## 按任务类型定位

| 我要做什么 | 先读 |
|---|---|
| 任何开发任务的**第一步** | [`../AGENTS.md`](../AGENTS.md)（契约 + spec-first 硬约束） |
| **新增/变更功能** | [`spec-standards.md`](spec-standards.md)（spec 分级/模板/DoD + 7 节点闭环）→ 对应 [`spec/`](spec/) |
| **写/改后端代码** | [`refactor-layering.md`](refactor-layering.md)（分层红线）+ [`backend-reuse.md`](backend-reuse.md)（后端复用速查） |
| **写/改前端页面组件** | [`components.md`](components.md)（组件复用速查）+ [`forms-tables.md`](forms-tables.md)（表单/表格盘点） |
| **写/改 AI 功能** | [`ai-development.md`](ai-development.md)（AIService 统一底座） |
| **安全非功能（密码/会话/备份/密钥/限流/上传）** | [`security-standards.md`](security-standards.md) |
| **写/审任何文档** | [`documentation-standards.md`](documentation-standards.md)（分层 + 砍废话）+ [`prose-standards.md`](prose-standards.md)（文字品控） |
| **做架构取舍/技术选型** | [`decisions/README.md`](decisions/README.md)（ADR：先看有没有既有决策） |
| **审 PR / 审改动** | [`code-review-checklist.md`](code-review-checklist.md)（语义检查） |
| **找可简化处 / 重构** | [`simplification-notes.md`](simplification-notes.md)（简化审计 + Agent Note） |
| **理解快照版本机制** | [`resource-snapshot-versioning.md`](resource-snapshot-versioning.md) |

## 文档分类（教程 vs 参考）

见 [`documentation-standards.md`](documentation-standards.md) 的判定标准。当前现状：

### 参考型（按需查，不要求顺序读）

- **规范/红线**：`refactor-layering.md`、`ai-development.md`、`security-standards.md`、`spec-standards.md`、`documentation-standards.md`、`prose-standards.md`、`code-review-checklist.md`、`simplification-notes.md`
- **速查/盘点**：`components.md`、`forms-tables.md`、`resource-snapshot-versioning.md`
- **规格（spec）**：`spec/` 全部（单一事实源，按需查）
- **决策（ADR）**：`decisions/` 全部（为什么这么做）

### 教程型（按顺序做完一件事）

- （暂缺，见 `documentation-standards.md`「三、当前缺口」）

## 目录结构速览

```
docs/
├── spec/                        # 功能规格（单一事实源）
│   ├── 01-prd.md ~ 05-prototype-interaction.md   # 全平台五层
│   └── partner-enterprise-platform.md            # 子平台示例
├── decisions/                   # ADR 决策记录（为什么这么做）
│   ├── README.md                # 索引 + 何时写
│   └── 0000-template.md         # 模板
├── spec-standards.md            # spec 规范（分级/模板/DoD/7 节点闭环）
├── documentation-standards.md   # 文档分层 + 砍废话
├── prose-standards.md           # 全仓文字品控
├── code-review-checklist.md     # 审 PR 语义检查
├── simplification-notes.md      # 简化审计 + Agent Note
├── refactor-layering.md         # 后端分层红线
├── backend-reuse.md             # 后端可复用资产速查
├── ai-development.md            # AI 统一底座
├── security-standards.md        # 安全非功能规范（密码/会话/备份/密钥/限流/上传）
├── components.md                # 组件复用速查
├── forms-tables.md              # 表单/表格架构盘点
├── resource-snapshot-versioning.md  # 快照版本机制
└── 系统功能清单.md               # 全平台能力盘点（人类/AI 对照用）
```

## scripts/ 工具清单

| 脚本 | 用途 |
|---|---|
| `deploy.sh`（仓库根目录） | 分支部署 + 质量门禁 + 自动合并 |
| `scripts/spec-check.sh` | spec 硬约束自动校验（分层/AI 底座/migration 配对+down 不可逆/spec 制品/ADR 索引/安全红线/schema↔migration 双向/spec 耦合） |
| `scripts/package-release.sh` | 离线实施包打包 |
| `scripts/migrate_uploads.sh` | 上传文件迁移 |
| `scripts/ui-smoke/` | 全站点击巡检（UI smoke test） |
