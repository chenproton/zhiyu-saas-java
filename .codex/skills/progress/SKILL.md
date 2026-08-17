---
name: progress
description: |
  /progress - 项目进度报告

  触发词：/progress、进度、进度报告、项目进度
---

# /progress - 项目进度报告

汇总当前 base-dev-framework6-java 项目/任务的进度。

## 执行

1. 激活 `task-tracker`。
2. 扫描任务台账（`.claude/docs/tasks/` 或 `docs/tasks/` 若存在），列出：进行中 / 待办 / 已完成。
3. 看最近 git 提交（`git log --oneline -15`）概括近期改动。
4. 输出结构化报告：
   - **本期完成**：模块/功能 + 对应提交
   - **进行中**：当前任务 + 卡点
   - **待办**：优先级排序
   - **风险/阻塞**：需要决策的点
5. 给出"下一步"指引（或提示运行 `/next`）。

## 说明

- 报告用东八区时间戳。
- 若无任务台账，基于 git 历史 + 当前工作树状态给出概览，并建议用 `task-tracker` 建立台账。
