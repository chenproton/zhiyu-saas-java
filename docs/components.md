# 前端组件复用速查

> ⚠️ **历史文档（React 时代）**：本文档原为 React 门户的组件速查表，React 前端已于 2026-08 随 Go→Java 单栈迁移删除，原组件清单（`ComboboxSelect`/`ConfirmDialog`/`StatusBadge`/`HoverActionBar`/`ImportWizardDialog` 等）已无对应实现，不再登记。

当前前端为 **Vue 单栈**，组件复用以根 `AGENTS.md` 第二部分（Java 框架契约）与前端工程源码为准：

- **业务门户** `frontend/portal-vue`（Vue 3.5 + Element Plus + Pinia）：通用组件位于 `src/components/`，布局壳位于 `src/layouts/`（`PlatformSideNav.vue` / `PortalLayout.vue` / `navigation-config.ts`），页面位于 `src/views/`。
- **管理端** `plus-ui`（RuoYi 框架）：通用组件位于 `src/components/`（`DictTag`/`Pagination`/`RightToolbar`/`ImageUpload` 等），页面位于 `src/views/`。
- **复用纪律**：接需求先判断能否复用现有组件/函数/模式，能复用直接使用；需抽公共组件先向用户提方案、经确认后实施（AGENTS.md「二、开发原则」）。
