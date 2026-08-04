# 前端 app 批次3 审查（62文件，14999行）

## P1
```
apps/edu/app/portal/apps/alliance/achievements/page.tsx:112,229 | P1 | 逻辑bug | 列表"前台展示"Switch 绑定 onToggleEnabled 为空函数 async () => {}，点击只触发列表刷新，后台 isPublic 永不更新 | 实现 onToggleEnabled：调 update(id, {isPublic:!item.isPublic}) 后刷新
```

## P2（摘要）
```
apps/edu/app/portal/apps/alliance/projects/page.tsx:49-58 | P2 | 性能 | for...of await 串行拉取每个项目的里程碑，N 个项目 N 次串行请求 | Promise.all 并行
apps/edu/app/portal/apps/system/logs/login/page.tsx:33-48 | P2 | 性能 | loadLogs 依赖 searchTerm，每次按键触发 effect 重新请求，搜索 limit=10000 全量拉取，无防抖 | 对 searchTerm 做 debounce
apps/edu/app/portal/apps/system/logs/operation/page.tsx:33-48 | P2 | 性能 | 同 login 日志：每次按键全量拉取 10000 条 | debounce
apps/edu/app/portal/apps/system/org-user/relations/page.tsx:49-66 | P2 | 性能 | loadRelations 依赖 searchText，每敲一个字符整表重拉，无防抖 | 增加防抖
apps/edu/app/portal/apps/alliance/projects/new/page.tsx:87-98 | P2 | 表单校验 | handleSave 未校验项目名称必填，可创建空名项目 | 保存前校验
apps/edu/app/portal/apps/alliance/achievements/new/page.tsx:77-88 | P2 | 表单校验 | handleSave 未校验成果名称必填 | 保存前校验
apps/edu/app/portal/apps/alliance/school/page.tsx:153-154 | P2 | 数据一致性 | province 不在预设省份列表时被强制改为北京、city 默认"东城区"，编辑弹窗静默篡改数据 | 保留原值或置空
```

## P3（摘要）
```
apps/edu/app/portal/apps/alliance/achievements/[id]/edit/page.tsx:68-80 | P3 | 表单校验 | 编辑保存未校验 title 必填 | 保存前校验
apps/edu/app/portal/apps/alliance/projects/[id]/edit/page.tsx:78-93 | P3 | 表单校验 | 保存草稿/发布均未校验项目名称 | 保存前校验
apps/edu/app/portal/apps/alliance/agreements/[id]/edit/page.tsx:152-165 | P3 | 表单校验 | 日期未校验必填及 endDate>startDate | 增加校验
apps/edu/app/portal/apps/alliance/school/page.tsx:165,222 | P3 | 类型安全 | formData 声明 Record<string,string> 却存数组，用 (formData as any) 绕过 | 定义明确类型
apps/edu/app/portal/apps/alliance/achievements/[id]/page.tsx:228-232,238-243 | P3 | 代码质量 | Badge key 用对象 p（强转 [object Object] 重复 key）| key 用 p.id
apps/edu/app/portal/apps/alliance/brands/[id]/page.tsx:106-117 | P3 | 逻辑bug | brand.data 为 undefined 时 JSON.stringify(undefined) != '{}'，空数据也渲染空白卡片 | 增加 brand.data && 判断
apps/edu/app/portal/apps/alliance/experts/[id]/edit/page.tsx:135-141 | P3 | 数据一致性 | partnerSource=cooperation 但企业未命中时 organization 被置空串覆盖原机构名 | 仅命中企业才回填
apps/edu/app/portal/apps/alliance/projects/[id]/page.tsx:407,420-428,136 | P3 | 性能/一致性 | render 中同一数组 filter 两次；createProjectAgreement 拼接 agreementIds 未去重 | useMemo/Set 去重
apps/edu/app/portal/apps/alliance/{enterprises,projects,permissions}/page.tsx | P3 | 性能 | onToggleEnabled 内部 fetch 后又触发 onRetry 双重刷新 | 去掉内部刷新
apps/edu/app/portal/apps/alliance/{agreements,brands/*,experts}/page.tsx | P3 | 死代码 | onToggleEnabled 空实现 | 移除或实现
apps/edu/app/portal/apps/alliance/dictionaries/page.tsx:31 | P3 | 死代码 | setDeleting 无实际用途 | 移除
apps/edu/app/portal/apps/system/org-user/roles/page.tsx:260-263,295-308 | P3 | 逻辑bug | 无 menus 权限的角色打开权限弹窗回显为全选，误点保存把所有菜单硬编码进 permissions.menus | 提示"全选=不限制"
apps/edu/app/portal/apps/system/org-user/roles/page.tsx:387 | P3 | 错误处理 | openUsersDialog catch 把错误 setError 到主页面 | 独立错误状态
apps/edu/app/portal/apps/system/org-user/fields/page.tsx:73-86 | P3 | 死代码 | handleToggle 中 original 从未使用 | 删除
apps/edu/app/portal/apps/system/org-user/students/page.tsx:247-273 | P3 | 逻辑bug | 状态按钮已为目标时仍可点击发无意义请求 | 按当前状态 disabled
apps/edu/app/portal/apps/system/org-user/teachers/page.tsx:258-275 | P3 | 逻辑bug | 同学生页 | 同上
apps/edu/app/portal/apps/system/resource/industries/page.tsx:176-183 | P3 | 数据一致性 | 上级行业下拉未排除当前行业的子孙节点，可形成环 | 前端禁用子孙节点
apps/edu/app/portal/apps/alliance/achievements/[id]/page.tsx:47 | P3 | 代码质量 | /career/positions 与 /job/positions 路径不一致 | 统一
apps/edu/app/portal/apps/page.tsx:142 | P3 | 性能 | visibleQuickAccess 每次渲染重新 filter | useMemo
```

## 无问题文件（21个严格零问题）
enterprises/[id]、enterprises/page、experts/[id]、experts/page、alliance/layout、alliance/page、projects/[id]、projects/page、agreements/new、enterprises/new、enterprises/[id]/edit、experts/new、experts/[id]/edit、portal/apps/alliance/layout、system/layout、org-user/accounts、org-user/graduates、org-user/org-structure、org-user/org-types、org-user/positions、system/page、system/resource/codes（其中部分有极轻微 P3 已单列）

总行数 14999
