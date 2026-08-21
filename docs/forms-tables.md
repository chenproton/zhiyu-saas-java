# 表单/表格架构盘点

> ⚠️ **历史文档（React 时代）**：本文档原为 React 门户的表单/表格架构盘点（`FormFieldRow`/`PortalCrudPage`/`ContentListPage` 等模式与共享 UI 原语），React 前端已于 2026-08 随 Go→Java 单栈迁移删除，原模式已无对应实现，不再登记。

当前前端为 **Vue 单栈**，表单/表格以 Element Plus 与 RuoYi 框架为准：

- **业务门户** `frontend/portal-vue`：`el-form` / `el-table` / `el-dialog` / `el-select` 等 Element Plus 组件 + `src/layouts/` 布局体系，页面见 `src/views/`。
- **管理端** `plus-ui`（RuoYi 框架）：表单/表格/分页（`Pagination`）等规范见框架文档与 `src/views/` 既有页面写法。
- 分页契约：`limit/offset` 参数、`{items,total}` 返回（`02-api-contract.md` §4.3）。
