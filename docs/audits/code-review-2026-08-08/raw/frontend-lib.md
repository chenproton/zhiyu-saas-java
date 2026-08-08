# 前端 lib/hooks/contexts 代码复查（2026-08-08）

复查范围：`apps/edu/lib`、`apps/edu/hooks`、`apps/edu/contexts`（37 个文件，逐行通读）。
本轮为 2026-08-07 全量审查后的复查，重点核对已修项回归、上轮遗漏（use-org-tree 错误文案、fetch-all 各调用点）、新问题。
后端分页钳制已核实：`store.ExecuteListQuery` 统一 `maxPageSize = 200`（backend/internal/store/query.go:439,478），所有走该路径的 list 接口 limit 超 200 被截断。

---

## apps/edu/hooks/use-approvals.ts
- [P1][数据丢失] use-approvals.ts:53 — `approvalApi.list({ targetType, limit })`（默认 limit=1000）走后端 `ExecuteListQuery` 被钳制为 200 条（backend/internal/store/query.go:439,478），同 targetType 审批记录超过 200 条时静默截断，仅显示最新 200 条，用户无法看到/审批更早的记录。上一轮为 use-submitter-names / use-resource-maps 引入 fetchAllPages 分页合并，此处是遗漏调用点；最佳实践：改用 `fetchAllPages((page, pageSize) => approvalApi.list({ targetType, limit: pageSize, offset: page * pageSize }))`。
- [P2][契约不符] use-approvals.ts:65 — `workflowApi.list({ limit: 1000 })` 同样被钳制为 200；流程数超过 200 时，其后的 workflowId 查不到 map，getStepInfo 退化为"第 {n} 步"占位名且 steps 为空（功能降级不崩溃）；最佳实践：改用 fetchAllPages 合并，或对缺失 workflowId 逐个 get。
- [P3][健壮性] use-approvals.ts:93 — `Math.min(record.currentStepIdx, ...)`：若后端 currentStepIdx 缺失/NaN，currentStepIndex 为 NaN，第 98 行会渲染"第 NaN 步"；最佳实践：`record.currentStepIdx ?? 0` 后参与计算。
- [P3][性能] use-approvals.ts:80 — refresh 的 useCallback 依赖含 `t`，切语言时 locale 变化导致整表重新拉取；最佳实践：将 t 依赖去掉或用 ref 引用。

## apps/edu/hooks/use-submitter-names.ts
- [P2][i18n 残留] use-submitter-names.ts:27 — 错误文案 `'获取用户列表失败'` 硬编码且未用 useT() 包裹，同时该 key 未收录 en.json（抽查 MISS），英文模式下报错信息保持中文；最佳实践：改用 useT() 并补齐 en.json 词条。
- 其余无问题：fetchAllPages 分页合并正确（users list 走 ExecuteListQuery 钳 200，offset 分页正确），cancelled 守卫齐全。

## apps/edu/lib/use-resource-maps.ts
- 无问题：两处 fetchAllPages 调用（industry/major，均为 createCrudApi list + limit/offset）与后端 200 钳制匹配，页码递进正确；失败仅 reportError 无 UI 提示属既定降级策略。

## apps/edu/hooks/use-org-tree.ts
- [P2][i18n 残留] use-org-tree.ts:66 — 错误文案 `'加载组织架构失败'` 未用 useT() 包裹（该 key 已存在于 en.json，属上轮"错误文案"遗漏项），英文模式下报错保持中文；最佳实践：hook 内 useT() 包裹后返回。
- [P3][契约不符] use-org-tree.ts:59 — `orgTypeApi.list({ tenantId, limit: 1000 })` 被钳制为 200；组织类型超过 200 时 typeNameMap 不完整（当前场景类型数量很少，风险低）；最佳实践：按需改用 fetchAllPages 或维持现状并注释。

## apps/edu/hooks/use-portal-users.ts
- [P2][i18n 残留] use-portal-users.ts:74 — 错误文案 `'加载失败'` 未用 useT() 包裹（en.json 有该 key，属遗漏包裹）；英文模式下报错保持中文。
- [P3][性能] use-portal-users.ts:57,82 — `roleApi.list` 每次都重拉（effect 依赖含 page/pageSize），且 limit 1000 被钳制 200，角色超 200 时 roleMap 不完整；最佳实践：roles 单独 effect 只依赖 tenantId，或用 fetchAllPages。
- [P3][状态管理] use-portal-users.ts:34 — 内部 page state 仅以 options.page 初始化，外部变化 options.page 不生效（若父组件受控翻页会失效）；最佳实践：受控时同步 options.page。

## apps/edu/lib/fetch-all.ts
- [P3][健壮性] fetch-all.ts:7-12 — 无最大迭代保护：若某后端忽略 offset 且每页恰返回 pageSize 条（或钳制值恰好等于请求值），会死循环；当前三个调用点（users/majors/industries）均正确支持 offset 不受影响；最佳实践：增加 maxIterations（如 100）防御并抛错。

## apps/edu/lib/evaluation-rule-store.ts
- [P3][逻辑瑕疵] evaluation-rule-store.ts:182,192 — `ADD_EVAL_POINT` 中 name 判定用 `preset?.name?.trim() || '未命名评价点'`，而 gradeMapping 分支用 `preset?.name === ''`（未 trim）：传 `'  '`（纯空白）时 name 为默认名但 gradeMapping 走 `[]` 分支，与传 `''` 行为不一致；最佳实践：统一用 trim 后的值判定。
- [P3][竞态] evaluation-rule-store.ts:304,333-347 — skipNextNotificationRef 为"跳过下一次通知"单次标记：若 prop 同步（evaluationMethods/initialConfig 变化）与用户 dispatch 落在同一批渲染，用户变更通知会被吞掉一次，受控场景下父组件漏收该变更；最佳实践：skip 标记只在"本轮 state 完全由 prop 同步产生"时设置（对比 state 差异），或拆分同步与用户动作的标识。
- [P3][健壮性] evaluation-rule-store.ts:197-198,203,211 — `(next as any)[field] = [...(next as any)[field]]` 若初始配置把对应数组字段置 undefined 会抛 TypeError（当前依赖 makeDefaultEvalRuleConfig 保证字段存在）；最佳实践：`?? []` 防御。
- 其余无问题：exam→homework 映射（:288）与 onChange 透传方法键已修复；initialConfig 同步用序列化 ref 对比防循环，设计正确。

## apps/edu/lib/hybrid-eval.ts
- [P3][i18n 残留] hybrid-eval.ts:6-10,36 — 模块标签硬编码中文（课前测验/随堂测验/课后作业，en.json 已有对应词条），getHybridMethodLabel 拼接前缀在英文模式下不翻译；最佳实践：调用方将模块标签也经 useT 翻译后注入，或该函数接受 label 注入函数。

## apps/edu/lib/format-utils.ts
- 无问题：hour12: false 已修复（formatDateTime 24 小时制），空值/非法值回退逻辑与测试一致。

## apps/edu/lib/i18n/locale-provider.tsx
- 无问题：translate 中文即 key、en.json 未命中回退中文、`{var}` 插值正确；setLocale 后刷新由 layout 内联脚本（app/layout.tsx:42）读 localStorage 兜底。

## apps/edu/contexts/portal-auth-context.tsx
- 无问题：纯 re-export（PortalAuthProvider/usePortalAuth 来自 components/auth-provider）。

## apps/edu/hooks/use-import-flow.ts
- 无问题：纯 re-export（@zhiyu/ui）。

## apps/edu/hooks/use-font-scale.ts
- 无问题：读取/持久化/应用字号档位正确；persist 置于 setLevel updater 内仅在 StrictMode 下多执行一次同值写入，无副作用。

## apps/edu/hooks/use-subscription-modules.ts
- 无问题：失败时保持 null（跳过套餐校验）符合"失败态不成为最严拦截态"的设计；cancelled 守卫齐全；reportError 保留排查线索。

## apps/edu/lib/active-role.ts
- 无问题：默认角色优先级 + localStorage 持久化 + 非法值回退逻辑正确。

## apps/edu/lib/menu-permissions.ts
- 无问题：订阅开关/菜单授权/已知路径回退逻辑与测试覆盖一致；knownMenuPaths 模块级只读缓存合理。

## apps/edu/lib/navigation-config.ts
- 无问题：各平台导航配置结构一致；adminNavigationConfig / unifiedNavigationConfig 均有引用；getPlatformCardModules 缺描述回退合理。

## apps/edu/lib/org-type-icons.ts
- [P3][风格] org-type-icons.ts:8-34 — 图标映射以中文类型名精确匹配（如"学校"），后端改类型名（如"二级学院"改"学院"）即静默回退默认图标；最佳实践：改为按类型 code 匹配或放宽为包含匹配。

## apps/edu/lib/resource-type-constants.tsx
- [P3][逻辑瑕疵] resource-type-constants.tsx:210,212 — `SOFTWARE_EXTS` 含 `'zip'` 与 `ARCHIVE_EXTS` 重叠，类型自动识别时 zip 归属有歧义（先命中 archive 则软件类型 zip 无法上传/识别）；最佳实践：从 SOFTWARE_EXTS 移除 zip。
- [P3][风格] resource-type-constants.tsx:19 — 仅 image 图标带 aria-label="图片"，其余图标无无障碍标签，不一致；最佳实践：统一补齐或统一省略。

## apps/edu/lib/frequent-services.ts
- [P3][逻辑瑕疵] frequent-services.ts:9-13 — 超 500 条清理时只删 count<=1 的条目：若 500 条全部 count>=2，清理永不发生，记录数持续膨胀；最佳实践：兜底删除 count 最小的一批或直接清空重建。

## apps/edu/lib/external-links.ts
- [P3][契约不符] external-links.ts:13-48 — 平台地址默认值为公网 http 地址（111.170.170.202），生产依赖环境变量覆盖，未覆盖时混合内容/内网不可达风险；最佳实践：部署时确保 NEXT_PUBLIC_* 全部配置（与既有 env 覆盖机制一致即可）。

## apps/edu/lib/error-handling.ts
- 无问题：非阻塞记录错误，dev/prod 分支输出合理。

## apps/edu/lib/theme-brand.ts
- 无问题：hex 校验、租户级缓存隔离、接口失败回退缓存/默认色，逻辑完整。

## apps/edu/lib/cover-gradients.ts
- 无问题：按 id 哈希稳定取色，同一对象跨页面颜色一致。

## apps/edu/lib/changelog-content.ts
- 无问题：静态内容手动维护，与任务无关。

## apps/edu/lib/public-routes.ts
- 无问题：/changelog 免登录白名单，逻辑单一正确。

## apps/edu/lib/font-size-scale.ts
- 无问题：档位钳制/取整/步进计算正确，测试覆盖完整。

## apps/edu/lib/converters/job-converters.ts
- 无问题：字段映射与默认值处理正确，测试覆盖完整。

## 测试文件（9 个）
- apps/edu/lib/converters/job-converters.test.ts — 无问题
- apps/edu/lib/evaluation-rule-store.test.ts — 无问题（覆盖权重钳制/均分/移动/评价点增删改/不可变性）
- apps/edu/lib/font-size-scale.test.ts — 无问题
- apps/edu/lib/format-utils.test.ts — 无问题（覆盖 hour12 修复后 24 小时制断言）
- apps/edu/lib/frequent-services.test.ts — 无问题
- apps/edu/lib/hybrid-eval.test.ts — 无问题（复合 key 解析/标签/排序覆盖完整）
- apps/edu/lib/i18n/translate.test.ts — 无问题
- apps/edu/lib/menu-permissions.test.ts — 无问题（订阅开关/回退/兜底放行覆盖完整）
- apps/edu/lib/resource-type-constants.test.ts — 无问题

## en.json 抽查结果（与本轮代码 t() 使用对照）
- use-approvals 全部 14 个 key 命中（含 `批量{action}成功，共 {n} 条`、`您暂无权限审批该条记录...`、`第 {n} 步`）✓
- `加载组织架构失败` 命中（但 use-org-tree 未用 t() 包裹 → 漏翻）✗
- `获取用户列表失败` 未收录 en.json（且 use-submitter-names 未包裹）✗
- `加载失败` 命中（use-portal-users 未包裹）✗
- `课前测验/随堂测验/课后作业` 命中（hybrid-eval 标签未接入翻译）✗
