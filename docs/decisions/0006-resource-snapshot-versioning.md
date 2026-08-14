# 0006: 资源快照与版本固化机制（发布即快照、成绩服务端盖章）

- 状态：已接受
- 日期：2026-08-14
- 取代：无

## 背景

内容实体（试卷/题库/场景任务/课程）发布后仍可被编辑，若评分/学习记录直接引用 live 数据，历史成绩会随内容漂移；且删除题目/节点时外键级联会连带毁掉历史成绩。快照版本机制（docs/resource-snapshot-versioning.md 设计定稿，migration 158 落地）就是为了解决「历史成绩可追溯、内容可继续演进」。

## 决策

1. 发布即快照：内容发布（Transition 落 published）时写入 resource_snapshots（resource_type + resource_id + version 唯一，version 服务端盖章）。
2. 快照表无 FK：resource_snapshots.snapshot_data 以 JSON 固化行数据，不建外键——删除题目/节点不影响已固化快照（删除保护另行校验引用）。
3. 成绩行 version 服务端盖章：考试结果/场景测评提交时由服务端解析当前有效版本（盖章口径：快照最新 → 回退 live 当前版本，见 `store/snapshots.go ResolveResourceVersion`）写入结果行；历史 bundle 读取的回退为「绑定版本 > ?v= > 最新快照 → live（仅当 live status='published'，否则 404）」，详见 `docs/resource-snapshot-versioning.md` §3/§5.2。
4. 版本号格式统一（migration 149）：v1.0 / V1.0 / 1.0 / v1 / vV1.0 归一为 V1.0 口径。

## 备选方案

1. 评分直接引用 live 内容 + 编辑即锁：实现最简单，但「发布后禁止编辑」会锁死迭代，与审批流冲突。否决。
2. 快照表带 FK：删除内容时快照级联删除 → 历史成绩丢失。否决。

## 后果

### 正面
- 历史成绩与已发布内容永不失联；内容可安全迭代（发布→再编辑→再发布形成新版本）。
- 评分回写可精确定位到学生答题时的试卷版本。

### 负面 / 代价
- 每条成绩提交需要一次版本解析查询（三级回退），提交链路多一跳。
- 快照数据为 JSON 固化（无 FK），跨表一致性靠写入时校验，无法由 DB 约束兜底。