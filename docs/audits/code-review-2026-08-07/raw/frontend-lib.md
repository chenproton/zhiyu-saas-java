# 前端 lib/hooks/contexts 代码审查报告

- 审查日期：2026-08-08（针对 2026-08-07 审计批次）
- 审查范围：apps/edu/lib/**、apps/edu/hooks/**、apps/edu/contexts/**（共 28 个文件，含 11 个测试文件）
- 审查方式：逐行通读 + 后端契约 grep 核实（rbac.go / approval_handler.go / subscription_handler.go / settings_handler.go / tenants.go / shared-types）
- 结论：无 P0；P1 0 项；P2 10 项；P3 若干。总体质量良好，主要问题集中在 i18n 残留与 exam↔homework 方法键双向映射不对称。

---

## apps/edu/lib/active-role.ts
- 无问题（localStorage 访问均有 try/catch 与 SSR 守卫，默认角色回退逻辑正确）

## apps/edu/lib/changelog-content.ts
- 无问题（纯静态内容）

## apps/edu/lib/converters/job-converters.ts
- [P3][类型] job-converters.ts:79 — `rec.positionType as PositionType` 未经校验的强制断言，后端若返回未知值会污染本地模型；最佳实践：加白名单校验或默认值兜底。
- [P3][健壮性] job-converters.ts:31 — `cp.shortName || (cp.name.length > 10 ? ...)` 假定 `cp.name` 非空，若后端返回空 name 将抛 TypeError；最佳实践：`(cp.name || '').length > 10`。

## apps/edu/lib/converters/job-converters.test.ts
- 无问题

## apps/edu/lib/cover-gradients.ts
- 无问题

## apps/edu/lib/error-handling.ts
- 无问题（生产环境保留 console.error 的设计符合"不静默吞错"原则）

## apps/edu/lib/evaluation-rule-store.ts
- [P2][逻辑] evaluation-rule-store.ts:345-347 — 导出配置时把所有 `homework` 反向映射为 `exam`，但 `'exam'` 不在 `EvalRuleMethodKey` 类型联合内（shared-types:5-11），且仅映射了 `evaluationMethods` 数组，`methodWeights`/`methodEvalObjects`/`methodResourceConfigs` 等兄弟字段仍保留 `homework` 键 → 导出配置内部键不一致；若父组件传入真实的 `homework` 方法（合法 key），导出后会被改写为 `exam`。当前调用方（course-evaluation-rules-dialog）通过二次归一化掩盖了此问题，但任何新消费方直接读 `onChange` 结果都会踩坑；最佳实践：导出时按"输入即输出"原样透传方法键，仅对来源为 `exam` 的做还原。
- [P3][健壮性] evaluation-rule-store.ts:136-155 — MOVE_METHOD_UP/DOWN 只防了 `idx <= 0` 与 `idx >= len-1`，未防 `idx > len-1`（如 idx=100 时 `methods[idx]` 为 undefined，交换后数组混入 undefined）；最佳实践：加 `idx >= length` 守卫。
- [P3][类型] evaluation-rule-store.ts:100,436 — `Record<string, any>` 出现在 action 类型与 setResourceConfig 签名中，store 层建议收敛为明确类型（如 EvalRuleResourceConfig）。
- [P3][逻辑] evaluation-rule-store.ts:190-194 — `preset?.name === ''` 用未 trim 的原始 name 判断，与第 182 行 `preset?.name?.trim()` 不一致：name 为纯空格时走"克隆全局映射"分支而非"空映射"分支；最佳实践：统一用 `(preset?.name ?? '').trim() === ''`。
- [P3][文档] evaluation-rule-store.ts:453-483 — `getEvalPoints/getScoreType/getRubricId/getQuestionIds` 对混合课复合 key（`preQuiz:quiz`）静默返回空数组/空值，调用方无任何提示；最佳实践：补充注释说明复合 key 需由调用方自行拆分。

## apps/edu/lib/evaluation-rule-store.test.ts
- 无问题

## apps/edu/lib/external-links.ts
- [P3][配置] external-links.ts:13-48 — 平台地址默认值指向演示环境 `http://111.170.170.202:300x`，若生产部署未配置 `NEXT_PUBLIC_*` 环境变量，iframe/跳转会连到演示机；且 https 站点嵌入 http 地址会被混合内容策略拦截；最佳实践：部署时强制校验环境变量，或默认值取相对路径。

## apps/edu/lib/font-size-scale.ts
- 无问题

## apps/edu/lib/font-size-scale.test.ts
- 无问题

## apps/edu/lib/format-utils.ts
- [P3][i18n] format-utils.ts:21 — `Intl.DateTimeFormat('zh-CN')` 硬编码中文 locale 且未显式指定 hour12，在不同 ICU 版本/浏览器下 24/12 小时制输出可能不一致（现有测试依赖 Node 的 h23 默认值）；最佳实践：显式传 `hour12: false` 或按当前 locale 动态选择。

## apps/edu/lib/format-utils.test.ts
- 无问题

## apps/edu/lib/frequent-services.ts
- [P3][逻辑] frequent-services.ts:9-13 — MAX_ENTRIES=500 的淘汰只删 `counts[k] <= 1` 的条目，若所有条目计数都 ≥2，条目数可长期超过 500 且每次点击都触发一次全量扫描+写回；最佳实践：淘汰低频条目（如取计数最小的若干）或超过上限时丢弃最低频项。

## apps/edu/lib/frequent-services.test.ts
- 无问题

## apps/edu/lib/hybrid-eval.ts
- [P2][i18n] hybrid-eval.ts:6-10 — `HYBRID_EVAL_MODULE_LABELS` 硬编码中文「课前测验/随堂测验/课后作业」，且经抽查 `en.json` 中「课前测验」无对应翻译（「随堂测验/课后作业」有），EN 模式下该标签仍显示中文；最佳实践：标签改为 key 常量并在调用方用 `t()` 翻译，或补全 en.json。
- [P3][注释] hybrid-eval.ts:29 — 注释示例 `'preQuiz:quiz' -> '课前测验 · 随堂测'` 与实际 `fallback(parsed.methodKey)` 行为不符（实际输出方法 key 本身）；最佳实践：修正注释。

## apps/edu/lib/hybrid-eval.test.ts
- 无问题

## apps/edu/lib/i18n/locale-provider.tsx
- [P3][设计] locale-provider.tsx:68 — `(en as Record<string, string>)[key]` 依赖 en.json 为顶层扁平结构（当前 4157 键全部扁平，成立），但无任何机制保证新增 key 必然补翻译；与"未命中回退中文"策略配合是刻意的，仅提示后续可引入 key 校验脚本。
- [P3][一致性] locale-provider.tsx:45-52 — setLocale 只写 localStorage，未同步 `document.documentElement.dataset.locale`（readInitialLocale 的数据源），刷新前的瞬时态依赖 layout 内联脚本兜底；最佳实践：setLocale 内同步更新 data-locale。

## apps/edu/lib/i18n/translate.test.ts
- 无问题

## apps/edu/lib/menu-permissions.ts
- [P2][i18n] menu-permissions.ts:42-69,181-257 — `buildMenuTree` 与 `permissionModuleConfig` 的平台名/落地页/动作标签全部硬编码中文，这些标签直接渲染在角色权限配置界面；EN 模式下不经过 `t()` 仍显示中文；最佳实践：label 处接入 `t()` 或引入集中式 key。
- [P3][契约] menu-permissions.ts:145-150 — `Object.entries(menus)` + `value === true` 严格布尔判断，与后端 `claims.Permissions["menus"]`（JSONMap map[string]bool，rbac.go:99）契约一致，但若后端某角色以数组形式下发 menus 将全部判为未授权（fail-closed）；当前无此情况，仅提示保持契约。

## apps/edu/lib/menu-permissions.test.ts
- 无问题

## apps/edu/lib/navigation-config.ts
- [P3][重复] navigation-config.ts:96-182 — `adminNavigationConfig` 与 `unifiedNavigationConfig`（8-94 行）除 currentPlatformId/label 外逐字重复（约 86 行）；最佳实践：抽公共基础配置再覆写差异字段。
- [P3][i18n] navigation-config.ts（全文）— 所有 label/brandTitle 硬编码中文且不经过 `t()`，EN 模式下侧边导航保持中文（若 platform-shell 渲染处未翻译）；建议统一接入翻译。
- [P3][死配置] navigation-config.ts:1120-1147 — `ai/opc/decision/research` 四个模块 href 均为 `'#'`、subModules 空数组，仅靠 `PLATFORM_CARD_DESCRIPTIONS` 的 '暂未开放' 兜底；若这些模块短期不开放，建议从 `platformModuleDefs` 移除或标记未启用。

## apps/edu/lib/org-type-icons.ts
- [P3][性能] org-type-icons.ts:8 — 图标/颜色映射表在每次调用时重建（含 5 个 lucide 组件引用）；最佳实践：提升为模块级常量。
- [P3][i18n] org-type-icons.ts:9-33 — 类型名硬编码中文（学校/二级学院/专业/班级/行政职能部门），与后端字典数据耦合，EN 环境或自定义类型名时全部落入默认分支；最佳实践：改为按类型 id 或字典映射。

## apps/edu/lib/public-routes.ts
- 无问题（/changelog 唯一公共页，与 auth-provider 的 401 拦截逻辑配合正确）

## apps/edu/lib/resource-type-constants.tsx
- [P3][逻辑] resource-type-constants.tsx:210,212 — `SOFTWARE_EXTS` 与 `ARCHIVE_EXTS` 均包含 `'zip'`，同一 .zip 文件按 software 或 archive 上传都可通过校验，可能导致资源类型归类歧义；最佳实践：从 software 列表移除 zip。
- [P3][i18n] resource-type-constants.tsx:19,256,261 — `aria-label="图片"` 与 `validateResourceFile` 的报错文案均为硬编码中文（文案较长且直接展示给用户）；最佳实践：接入 `t()` 或至少把常用文案迁移到字典。
- [P3][健壮性] resource-type-constants.tsx:267 — `formatSize(0)` 因 `!bytes` 返回 '-'，0 字节文件显示异常；最佳实践：改为 `bytes === undefined || bytes === null`。

## apps/edu/lib/resource-type-constants.test.ts
- 无问题

## apps/edu/lib/theme-brand.ts
- [P3][一致性] theme-brand.ts:12-25 vs apps/edu/app/layout.tsx:47 — layout 内联脚本只读取全局键 `zhiyu-brand-color`，而 `applyBrandColor` 会写入租户级键 `zhiyu-brand-color-{tenantId}`，刷新时租户主题色先闪默认色再恢复；最佳实践：内联脚本同步支持租户级键。
- [P3][契约] theme-brand.ts:43-53 — 已核实后端 `GET /api/v1/settings/theme?tenantId=` 返回 `{primary}`（settings_handler.go:26-55），契约一致；失败时静默回退缓存色为设计取舍，可接受。

## apps/edu/lib/use-resource-maps.ts
- [P2][数据完整性] use-resource-maps.ts:12,31 — `limit: 1000` 硬编码且不传 tenantId 过滤，行业/专业超过 1000 条时列表被截断，map 静默缺失 name（详情页显示原始 id）；最佳实践：确认后端分页上限并分批拉取，或接口增加按需搜索。
- [P3][重复] use-resource-maps.ts:7-43 — `useIndustryMap` 与 `useMajorMap` 结构完全重复；最佳实践：抽 `useNameMap(fetcher)` 公共 hook。
- [P3][生命周期] use-resource-maps.ts:10-21 — 未做卸载守卫（cancelled flag），组件卸载后 resolve 仍会 setState（React 18 不告警但属反模式）；最佳实践：参照 use-org-tree 的 cancelled 模式。

## apps/edu/hooks/use-approvals.ts
- [P2][i18n] use-approvals.ts:18,166 — `PERMISSION_DENIED_HINT` 未收录进 en.json（已核实 missing），且第 166 行直接渲染常量未走 `t()`，EN 模式下批量驳回权限不足提示为中文，与 119 行（有 `t()`）不一致；最佳实践：为常量补充 en.json 翻译并统一用 `t(PERMISSION_DENIED_HINT)`。
- [P3][性能] use-approvals.ts:65 — `workflowApi.list({ limit: 1000 })` 每次刷新拉取全量工作流再按需过滤；最佳实践：按 workflowIds 批量查询或改用 get(id) 并发。
- [P3][性能] use-approvals.ts:53 — 审批列表 `limit: 1000` 硬编码，审批量超 1000 时静默截断；最佳实践：服务端分页。
- [P3][类型] use-approvals.ts:20,75,116,138,164,177 — 多处 `err: any`；最佳实践：引入 ApiError 类型。
- [P3][并发] use-approvals.ts:50-80 — refresh 无请求序号/取消机制，连续触发时后发响应可能覆盖先发；最佳实践：加 cancelled flag。

## apps/edu/hooks/use-font-scale.ts
- 无问题（挂载后读存储避免 hydration 不一致、persist 放 setState 内副作用在 StrictMode 下仅重复写同值，无害）

## apps/edu/hooks/use-import-flow.ts
- 无问题（纯 re-export）

## apps/edu/hooks/use-org-tree.ts
- [P3][类型] use-org-tree.ts:23-31 — `flattenOrgs` 只给顶层拷贝挂 `depth`，`children` 断言为 `OrgTreeNode[]` 但实际指向原始 `Organization`（无 depth），递归子节点 `depth` 为 undefined，类型断言是谎言；最佳实践：递归时为每个节点创建拷贝，或把 children 类型改为 `Organization[]`。
- [P3][i18n] use-org-tree.ts:66 — 错误兜底文案「加载组织架构失败」硬编码；最佳实践：走 `t()`。

## apps/edu/hooks/use-portal-users.ts
- [P2][状态管理] use-portal-users.ts:34 — `options.page` 仅用于初始化 state，之后父组件改变 `options.page` 不会同步（受控/非受控混用），分页外部控制时页码失效；最佳实践：page 改为受控 props 直接消费，或用 useEffect 同步。
- [P3][性能] use-portal-users.ts:57 — 每次翻页/搜索都重新 `roleApi.list({limit: 1000})` 拉全量角色；最佳实践：角色列表一次性拉取后缓存。
- [P3][依赖] use-portal-users.ts:82 — effect 依赖 `options.roleCode/search/status`，若调用方每次渲染构造新对象没问题（均为基本类型），但 page 依赖是内部 state，当 options.page 变化时不会重取数——与第 34 行问题同源。

## apps/edu/hooks/use-submitter-names.ts
- [P2][数据完整性] use-submitter-names.ts:18 — `userManagementApi.list({ limit: 1000 })` 全量拉取用户，超 1000 时姓名映射缺失，`getName` 回退显示原始 userId（对非本人可见的隐私兜底逻辑），且不传 tenantId（依赖服务端从 token 推断）；最佳实践：确认用户量级并支持分批/搜索式补充拉取。
- [P3][i18n] use-submitter-names.ts:23 — 「获取用户列表失败」硬编码；最佳实践：走 `t()`。

## apps/edu/hooks/use-subscription-modules.ts
- [P3][健壮性] use-subscription-modules.ts:20 — tenantId 未经 encodeURIComponent 直接拼 URL；最佳实践：`encodeURIComponent(tenantId)`。
- [P3][健壮性] use-subscription-modules.ts:23 — `typeof data.modules === 'object'` 对数组也成立，若后端返回数组会被当成模块表；最佳实践：补 `!Array.isArray`。
- 已核实契约：后端 `GET /subscriptions` 返回 `SubscriptionPackage{modules: JSONMap}`，模块键与前端 platformId（system/career/course/scene/ability/resource/affairs/alliance）一致（tenants.go 默认套餐），未订阅返回 404 → 前端 catch 保持 null 跳过套餐校验，fail-open 设计正确。

## apps/edu/contexts/portal-auth-context.tsx
- 无问题（纯 re-export 适配层）

---

## messages/en.json 抽查（与 t('...') 使用对照）

抽查方式：脚本全量扫描 apps/edu 下 t('...') 字面量 key 与 en.json（4157 键）比对。

- [P2][i18n] 全站共 47 处正则命中中，去重后**确认缺失 3 个 key**，其中本次审查范围内 1 个：
  - `您暂无权限审批该条记录，请确认自己是当前步骤审批人` — 使用于 hooks/use-approvals.ts:18（经 t() 调用，EN 回退中文）+ 166（未走 t()，必显中文）
  - `· 点击下方"保存顺序"生成学习路径`（app/job/learn-roads/page.tsx，范围外顺带记录）
  - `Logo URL`（app/portal/apps/alliance/enterprises/page.tsx，范围外顺带记录）
- [P2][i18n] 硬编码中文残留（不经 t() 直接渲染或作为常量）：hybrid-eval.ts 模块标签、navigation-config/menu-permissions 全部导航标签、resource-type-constants 报错文案、use-org-tree/use-submitter-names 错误兜底、org-type-icons 类型名 —— 详见各文件条目。
- 其余抽查 key（审批/批量/第 N 步/插值类）均已在 en.json 中存在且占位符命名一致，未发现插值参数与翻译不匹配。
