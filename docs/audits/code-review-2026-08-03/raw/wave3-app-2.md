# 前端 app 批次2 审查（65文件，14108行）

## P1
```
apps/edu/app/lesson/admin/granular/add/page.tsx:47-48 | P1 | 数据一致性 | 模块级可变单例 customKnowledgePointIds/courseResourcePool 在所有组件实例/用户间共享；useEffect 里 clear()/length=0 清空后重填，多标签页同时编辑课程会互相清空对方资源池与自定义知识点集（竞态+串数据）。且 :471 把临时 id（kp-custom-*）写入共享 Set 永久残留 | 改为 useRef/useState 组件内状态，随组件生命周期管理
apps/edu/app/lesson/admin/granular/add/page.tsx:321-324 | P1 | 逻辑bug | handleFinish 无条件 await handleSave() 后立即 router.push；handleSave 内部 catch 吞错并返回 void，保存失败时也会跳走，用户输入全部丢失 | handleSave 改为返回 boolean，成功后才跳转
apps/edu/app/lesson/admin/hybrid/add/page.tsx:340 | P1 | React反模式 | ensureNodeData 在渲染期调用 setNodeDataMap，渲染中 setState 会触发额外渲染，StrictMode 下可能告警/循环 | 改为 useMemo 返回 fallback 或在事件中初始化
apps/edu/app/lesson/admin/hybrid/add/page.tsx:138-165,167 | P1 | 逻辑bug | initialNodes 依赖 existing?.name，而 existing 首帧为 null；后续加载课程后只 setExisting，nodes 状态不更新，编辑模式课程树根节点名称永远显示"混合课程" | existing 加载完成后用 effect 同步更新 nodes[0].name
apps/edu/app/lesson/admin/system/add/page.tsx:801-804 | P1 | 逻辑bug | handleFinish 在 handleSave 失败（catch 吞错）时仍 router.push 离开，体系课保存失败数据丢失 | handleSave 返回成功标志，成功后再导航
apps/edu/app/lesson/admin/system/add/page.tsx:253 | P1 | 逻辑bug | handleAddNode 硬编码 courseId: 'course-1'，新增节点本地 courseId 与实际课程不符 | 传入真实 courseId
apps/edu/app/lesson/admin/hybrid/add/_components/teaching-resource-selector.tsx:202-217 | P1 | 数据一致性 | handleSave 将选中资源映射为 {id,name,type,source}，丢弃 url 及全部元数据，父级保存后资源无真实链接 | 保留 url 等字段
```

## P2（摘要）
```
apps/edu/app/lesson/admin/system/add/page.tsx:174-240 | P2 | 性能 | 加载课程 effect 依赖 [editId, abilityPool]，abilityPool 异步加载完成后整个 effect 重跑，重复发 3 个请求 | 拆分 effect
apps/edu/app/lesson/admin/system/add/page.tsx:551 | P2 | 类型 | courseApi.get(`${grain.id}?_t=${Date.now()}` as any) 缓存击穿拼进路径 | 使用 API 支持的缓存参数
apps/edu/app/lesson/admin/system/add/page.tsx:636-650 | P2 | 数据一致性 | 自定义知识点创建时 sourceType:'course_node' 但未传 sourceId，重载后匹配不到，被标为 linked 而非课程私有 | 创建时带 sourceId
apps/edu/app/lesson/admin/system/add/page.tsx:197-202 | P2 | 逻辑bug | abilityPool 未加载完成时回填能力点，fallback 把 UUID 当名称显示 | 能力点回填在 abilityPool 就绪后
apps/edu/app/lesson/admin/system/add/page.tsx:659-665 | P2 | 数据一致性 | 本地上传资源仅当 id.startsWith('res-') 走 create，其余静默绑定失败 | 统一用明确前缀或显式 isLocal 标记
apps/edu/app/lesson/admin/hybrid/add/page.tsx:269-296 | P2 | 数据一致性 | handleDeleteNode 只删自身 moduleAssignments/nodeDataMap，子孙状态残留；删除祖先选中态悬空 | 收集全部子孙 id 一并删除
apps/edu/app/lesson/admin/hybrid/add/_components/atomic-modules.tsx:718-897 | P2 | 死代码/功能缺失 | ClassQuestionsModule"从题库引用"基于恒空 EMPTY_QUESTION_BANK，功能不可用 | 接入真实题库 API 或移除
apps/edu/app/lesson/admin/hybrid/add/_components/atomic-modules.tsx:899-1216 | P2 | 死代码/功能缺失 | PracticeTasksModule"从实践场景库引用"基于恒空 EMPTY_SCENARIOS，整块不可用 | 接入真实 API 或移除
apps/edu/app/lesson/admin/hybrid/add/_components/atomic-modules.tsx:334 | P2 | 功能缺失 | AttachmentListEditor"选择资料"只写假文件名，无真实上传 | 接入 fileApi.upload
apps/edu/app/lesson/admin/hybrid/add/_components/teaching-resource-selector.tsx:138,153-155 | P2 | 功能缺失 | INITIAL_LEARNING_RESOURCES 恒为空，资源库弹窗无真实数据源；选择后不持久化 | 接入 resourceLibraryApi 并持久化
apps/edu/app/lesson/admin/hybrid/add/_components/teaching-resource-selector.tsx:185-188,298 | P2 | 数据一致性 | openDialog 用 items 恢复 selectedResIds 但 learningResources 为空，已配置资源弹窗中不可见 | 用 items 重建 learningResources
apps/edu/app/lesson/landing/[id]/page.tsx:201-232 | P2 | 性能 | 节点/资源/知识点在 activeTab 变化时整体重取，切 tab 重复 3 个请求 | 拆分依赖，评估数据按需加载
apps/edu/app/lesson/landing/[id]/page.tsx:235-255 | P2 | 稳定性 | 每节点逐个请求无取消/去重，nodes 变化或卸载后旧回调 setState | AbortController/序号守卫
apps/edu/app/lesson/landing/[id]/page.tsx:295-301 | P2 | 逻辑bug | totalEvalCount 统计有 teachingGoals 的节点数，却标注"节点评价标准 共 N 个节点" | 按 evalData 配置统计
apps/edu/app/lesson/landing/[id]/page.tsx:461 | P2 | 逻辑bug | 节点作业只取 node.homeworks[0]，多作业场景其余隐藏 | 遍历全部 homeworks
apps/edu/app/lesson/landing/[id]/page.tsx:864 | P2 | 安全/稳定性 | course.creatorId.slice(0,8) 暴露原始用户 id 前缀；null/undefined 直接抛错 | 后端返回脱敏姓名并判空
apps/edu/app/lesson/landing/page.tsx:116,171-178 | P2 | 性能 | 一次性拉 1000 条全量发布课程，超 1000 条直接丢失 | 服务端分页
apps/edu/app/library/_components/use-library-crud.ts:42-65 | P2 | 性能/稳定性 | 搜索无防抖，无取消机制，乱序响应覆盖新结果 | 防抖 + 请求序号
apps/edu/app/library/ability/page.tsx:53-55 | P2 | 性能 | searchQuery 变化导致 loadItems 重建，每敲字重新请求 | 复用 hook 防抖
apps/edu/app/library/questions/page.tsx:35 | P2 | 数据一致性 | limit:9999 被服务端 maxPageSize≈200 截断且无提示 | 检测 total 并提示分页
apps/edu/app/library/my-resources/page.tsx:123-135 | P2 | 数据一致性 | 明确 TODO：creatorId 过滤全量列表被 200 截断，无分页 | 服务端分页
apps/edu/app/library/resources/_components/use-resource-crud.ts:128-177 | P2 | 逻辑bug | 文件类资源允许不选文件直接创建（willUploadFile && !uploadFile 时静默跳过上传，url=undefined）| 文件类强制要求选择文件
apps/edu/app/library/resources/_components/use-resource-crud.ts:37 | P2 | 数据一致性 | limit:500 被服务端截断到 200 无提示、无分页 | 服务端分页
apps/edu/app/library/resources/_components/resources-page.tsx:181-182 | P2 | 逻辑bug | 总览统计卡片取 Object.entries(typeCounts).slice(0,5)，顺序取决于 items 插入序，展示类型卡片随机 | 按 ALL_TYPES 固定顺序取前 5
apps/edu/app/library/landing/page.tsx:115-119,241-244 | P2 | 逻辑bug | buildKkFileViewUrl 用 btoa 未 encodeURIComponent，base64 含 +/=/ 被 URL 解码破坏 | btoa 后 encodeURIComponent
apps/edu/app/library/landing/page.tsx:143 | P2 | 性能 | 资源一次拉 500 条，筛选统计基于截断数据不完整 | 服务端分页
apps/edu/app/portal/alliance/brands/{culture,employer,job,major,teacher}/page.tsx:47-52 | P2 | 安全 | 公开页面直接展示 item.majorId/enterpriseId/studentId/teacherId 原始内部 id | 后端返回可读名称
```

## P3（摘要）
```
apps/edu/app/lesson/admin/system/add/page.tsx:124 | P3 | 死代码 | setLoadingEdit 从未被消费 | 使用或删除
apps/edu/app/lesson/admin/system/add/page.tsx:856-863 | P3 | 逻辑bug | currentCheckNode 用 新值.length>0?新值:node.旧值，清空资源/知识点后回退显示旧值 | 直接使用表单当前值
apps/edu/app/lesson/admin/system/add/page.tsx:746-761 | P3 | 数据一致性 | 课程 payload 不含 code/contentCode；creatorId 硬编码 '' | 补充 code 字段
apps/edu/app/lesson/admin/system/add/page.tsx:688-691 | P3 | 逻辑bug | draft?.estimatedHours || node.estimatedHours 优先级依赖短路，估时 0 误判 | 显式括号
apps/edu/app/lesson/admin/hybrid/add/page.tsx:214 | P3 | 性能 | 每次渲染调用 createDefaultNodeModuleData().form 作为 fallback | useMemo
apps/edu/app/lesson/admin/hybrid/add/_components/atomic-modules.tsx:562-599,679-716,1218-1256 | P3 | 重复代码 | 三个"测评方式+评价规则"模块体完全重复 | 抽公共组件
apps/edu/app/lesson/admin/hybrid/add/_components/teaching-resource-selector.tsx:266 | P3 | 类型安全 | } as LearningResource 断言掩盖 extraData | 收敛类型
apps/edu/app/lesson/admin/_components/common/rich-text-editor.tsx:203 | P3 | 安全 | iframe src=pdfUrl 直接嵌入用户可控 URL | 校验协议/域名
apps/edu/app/lesson/admin/_components/courses/course-admin-page.tsx:42-45,103,35 | P3 | 安全/死代码 | 展示 creatorId 原始 id；as Course 强转；lessonCount:0 硬编码 | 后端返回姓名
apps/edu/app/lesson/admin/approvals/page.tsx:35,46 | P3 | 类型/性能 | history?: any[]；每次进入拉取 1000 条字典 | 补类型/按需
apps/edu/app/lesson/admin/archive/page.tsx:40-44 | P3 | 代码质量 | 无参 async IIFE | 直接 loadData()
apps/edu/app/lesson/landing/[id]/page.tsx:907,205,206 | P3 | 死代码/类型 | "开始学习"按钮无 onClick；多处 as any | 修正
apps/edu/app/lesson/landing/page.tsx:180-184 | P3 | 代码质量 | async IIFE 包 setCurrentPage | 去掉
apps/edu/app/library/ability/page.tsx:95-131 | P3 | 稳定性 | 提交/删除中按钮未禁用 | 提交态禁用
apps/edu/app/library/certificates/page.tsx:86-110 | P3 | 稳定性 | 保存无进行中状态 | 增加 submitting
apps/edu/app/library/knowledge/page.tsx:52-56 | P3 | 代码质量 | 无参 async IIFE | 直接调用
apps/edu/app/library/knowledge/_components/knowledge-point-form-dialog.tsx:60-69 | P3 | 代码质量 | 简单状态同步也用 async IIFE | 直接同步赋值
apps/edu/app/library/questions/page.tsx:38,44,46,159 | P3 | 类型安全 | editing/majors/tableBody 大量 any；majorNameMap 每次重建 | 补类型+useMemo
apps/edu/app/library/my-resources/page.tsx:127,140,153,166,181 | P3 | 类型安全 | userId! 非空断言 | 判空后传参
apps/edu/app/library/resources/_components/use-resource-crud.ts:128-153 | P3 | 稳定性 | 提交中按钮未禁用 | submitting 状态
apps/edu/app/library/resources/_components/resources-page.tsx:374 | P3 | 类型安全 | addPreviewResource(item as any) | 补类型
apps/edu/app/library/landing/page.tsx:195,207,897,956,1114-1176 | P3 | 逻辑/类型/合规 | now 固定挂载时刻；WebkitBoxOrient as any；footer 假占位信息 | 修正
apps/edu/app/portal/alliance/achievements/[id]/page.tsx:21-29 | P3 | 稳定性 | 请求无取消，卸载后 setState；fetch 失败与"成果不存在"混为一态 | AbortController
apps/edu/app/portal/alliance/brands/*/page.tsx:1-60 | P3 | 重复代码 | 6 个品牌列表页结构 100% 相同 | 抽公共组件
apps/edu/app/portal/alliance/brands/major/[id]/page.tsx:21-29 | P3 | 稳定性 | 请求无取消/无 error/empty 区分 | 同上
apps/edu/app/lesson/admin/system/add/_components/CourseNodeTree.tsx:206-211 | P3 | 稳定性 | NODE_REF_TYPE_COLORS[node.type] 未知类型 className undefined | 提供默认值
```

## 无问题文件（23个）
job/workflows、app/layout、lesson/admin/batches、knowledge/knowledge-selector、resources/resource-selector、granular/page、registrar-adapted、hybrid/page、lesson/admin/layout、system/page、lesson/admin/workflows、PublishCheckPanel、lesson/landing/layout、lesson/layout、library-page-shell、granular-lesson-select-dialog、library/landing/layout、library/layout、resource-upload-zone、library/resources/page、library/resources/[type]/page、not-found、portal/alliance/brands/page

总行数 14108
