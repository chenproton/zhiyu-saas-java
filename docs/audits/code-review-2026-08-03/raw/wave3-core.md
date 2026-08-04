# 前端 hooks/lib/contexts 审查（22文件，3447行）

## P2（摘要）
```
apps/edu/hooks/use-approvals.ts:90-98 | P2 | 逻辑/数据一致性 | 工作流未加载或加载失败（61-71 catch 静默吞）时 totalSteps 兜底为 1，isFinalStep 恒 true，多步审批被误判"最终一步" | 工作流缺失时 isFinalStep 置 false 或依赖 currentStepIdx 与 steps 长度
apps/edu/hooks/use-approvals.ts:91 | P2 | 逻辑边界 | currentStepIdx 只做上界钳制，未做下界，负值时 steps[-1] 显示错乱 | 加 Math.max(0,…)
apps/edu/hooks/use-subscription-modules.ts:23-27 | P2 | 权限边界 | typeof data.modules === 'object' 对 null 也为 true（null 走 setModules(null) 跳过校验），而缺 modules 键走 else setModules({}) 最严拦截态——空对象会让全部平台菜单被 checkMenuPermission 拒掉 | 显式 data.modules != null 判定，缺键时返回 null
apps/edu/lib/menu-permissions.ts:195 | P2 | 权限边界 | 订阅对象为 {} 时所有平台路径全部被拒，叠加空对象路径可整体锁死菜单 | 订阅对象为空时跳过套餐检查
apps/edu/lib/converters/job-converters.ts:154-158 | P2 | 字段映射 | 本地 description（能力描述）被填成 rubricDescription（量规表现），两概念混用 | description 独立来源
```

## P3（摘要）
```
use-approvals.ts:61-72,156,80-84 | P3 | 一致性/类型/稳定性 | workflows Map 保留旧条目；(r as any).reason 脆弱；refresh 无 cancelled | 修正
use-portal-users.ts:57,82,34 | P3 | 死代码/性能/一致性 | tenantId 已判空三元恒 truthy；roles 与 users 同 effect 串行；page 初始值不跟随 options.page | 修正
use-org-tree.ts:25,23-31 | P3 | 一致性/稳定性 | orgMap 与 state 共享对象引用；flattenOrgs 递归无环防护 | 深拷贝/visited 集合
use-submitter-names.ts:18 | P3 | 一致性 | 用户列表 limit:1000 不带 tenantId，超千用户映射缺失且跨租户泄露风险 | 按需分页/tenantId
use-subscription-modules.ts:40 | P3 | 代码质量 | 无 loading 态 | 返回 { modules, loading }
menu-permissions.ts:42-45,199 | P3 | 权限边界 | buildMenuTree 把落地页塞进 knownMenuPaths，menus={} 连公开落地页被拒；menus 非对象直接 return true 与 menus=[] 不对称 | 修正/注释固化
active-role.ts | 无实质问题
job-converters.ts:35,156,31 | P3 | 字段映射/类型 | salaryMin/Max 单侧 null 产出 [0,max]；requiredLevel 盲转；shortName slice 按码元截断多字节 | 修正
job-converters.test.ts:177-227 | P3 | 测试质量 | 未覆盖 salaryRange undefined、单侧缺失、convertApiAbilityToLocal、description=rubricDescription | 补用例
evaluation-rule-store.ts:192,274,343-349,288/197 | P3 | 逻辑/性能/一致性/类型 | name==='' 与 undefined 行为不一致；unknown action 返回新对象；methodWeights 键与导出的 exam 命名不一致；动态索引展开 | 修正
evaluation-rule-store.test.ts:9-140 | P3 | 测试质量 | 未覆盖 SET_METHODS/SET_CONFIG/ADD 等分支 | 补用例
navigation-config.ts:96-182,1052-1079 | P3 | 重复代码/死代码 | admin 与 unified 配置完全重复；ai/opc/decision/research 模块 href 为 # 占位 | 收敛/标注
org-type-icons.ts:8-34 | P3 | 性能 | map 每次调用重建 | 模块级常量
resource-type-constants.tsx:99-103,58-84 | P3 | 边界/重复 | formatSize 0 返回 -、无 GB 档；resourceTypeAccept 与 extensionMap 重复 | 修正
use-resource-maps.ts:10-21,29-40 | P3 | 稳定性/重复 | 无 cancelled 守卫、无 loading/error、结构完全相同 | 工厂合并
format-utils.ts:11-13,17-27 | P3 | 边界 | 'YYYY-MM-DD' 按 UTC 解析本地时区格式化，西半球时区日期偏移一天 | zoned 解析或统一 UTC
external-links.ts:13-49 | P3 | 安全 | 默认值全 http 明文演示 IP，https 下混合内容被拦截 | https 默认值
error-handling.ts:26-31 | P3 | 安全 | 生产环境 console.error 全量 payload（含 extras），敏感信息落浏览器日志 | 生产仅记 source+message
```

## 无问题文件（4个）
contexts/portal-auth-context.tsx、hooks/use-import-flow.ts、lib/menu-permissions.test.ts、lib/format-utils.test.ts

总行数 3447
