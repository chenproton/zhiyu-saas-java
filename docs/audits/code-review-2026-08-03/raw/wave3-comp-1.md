# 前端 components 批次1 审查（54文件，18720行）

## P2（功能/数据正确性）
```
apps/edu/components/evaluation-rules/evaluation-rules-editor.tsx:1906-1940 | P2 | 逻辑bug | 试卷详情对话框关闭按钮调用 setPaperDetailOpen(false)（未使用的 setter），而对话框 open 用的是 paperDetailOpenLocal，导致「关闭」按钮无法关闭弹窗 | 改为 setPaperDetailOpenLocal(false)
apps/edu/components/evaluation-rules/evaluation-rules-editor.tsx:3231-3252 | P2 | 数据一致性 | 「保存到模板-替换现有模板」仅更新内存 rubricLibrary，未调 taskEvaluationApi.updateTemplate 持久化，刷新后丢失 | replace 分支也调用后端更新接口
apps/edu/components/evaluation-rules/bank-question-selector-panel.tsx:44,430-431,288-354 | P2 | 数据一致性 | maxCount prop 仅用于展示 (n/max)，onToggleQuestion 无数量上限校验，quiz 传 maxCount=30 实际可无限选 | 达到上限时拦截并提示
apps/edu/components/job/position-builder/step-ability-modeling.tsx:212-220,749-755 | P2 | 逻辑bug | 「仍要新建」按钮仅清空 duplicateName，再次点「创建并关联」重新命中同名检测，用户永远无法创建同名自定义能力点 | 增加强制新建标志绕过重复检测
apps/edu/components/scene/student/knowledge-graph.tsx:49-58 | P2 | 逻辑bug | 同一知识点被多个任务引用时重复 push 相同 id 节点，节点 id 不唯一，渲染异常 | 用 Set 去重
apps/edu/components/knowledge-graph/knowledge-graph-d3-view.tsx:446-488 | P2 | 逻辑bug | 选中/高亮样式 effect 在挂载时也运行，把主渲染 effect 为高亮节点设置的 fill-opacity:0.95/红色 fill 覆盖为 0.16，高亮几乎不可见 | 第二个 effect 跳过未选中节点
apps/edu/components/evaluation/exam-form-dialog.tsx:88-100 | P2 | 数据一致性 | 表单无时长输入但提交固定 duration:60，编辑已有试卷保存后把原时长覆盖为 60 | 编辑时保留 exam.duration 或补时长字段
apps/edu/components/evaluation/question-form-dialog.tsx:89,147,211-219 | P2 | 数据一致性 | 弹窗无分值输入控件，新建题目 score 恒为 0（仅编辑时回填），题目分值无法配置 | 增加分值输入并校验
apps/edu/components/job/student/ability-tree.tsx:44-45 | P2 | 空值未判空 | d.bindingIds.includes(b.id) 未判空，bindingIds 为 undefined 时抛异常 | (d.bindingIds || []).includes(b.id)
```

## P3（摘要）
```
knowledge-graph/knowledge-graph-d3-view.tsx:190-444 | P3 | 性能 | ResizeObserver 每次尺寸变化全量重建 D3 力导向图 | 节流 debounce resize
knowledge-graph/knowledge-graph-d3-view.tsx:119-135,317-325 | P3 | 性能 | getD3IconSvg 每节点每次 new DOMParser() | 缓存 SVG 常量
knowledge-graph/knowledge-graph-d3-view.tsx:589-599 | P3 | 死代码 | arrow-d3 marker 从未被引用 | 删除或加 marker-end
knowledge-graph/knowledge-graph-d3-view.tsx:272-288 | P3 | 稳定性 | 重建时 drag 闭包残留监听 | 清理旧 drag
knowledge-graph/knowledge-graph-view.tsx:142-147,203-224 | P3 | 类型/性能 | rfRef=useRef<any>；filteredEdges 非 memo 致 layoutedEdges memo 失效 | 消除 any/memo 化
knowledge-graph/knowledge-graph-shell.tsx:91-115 | P3 | 组件API | toolbarSlot 时视图切换按钮被替换但 viewMode 无外部控制 | 外部受控
evaluation-rules/shared-defs.ts:21,26-28 | P3 | 死代码 | _allQuestions 无写入入口，getAllQuestions() 恒空 | 删除或补写入
evaluation-rules/constants.tsx:103-109 | P3 | 重复代码 | questionBankLabels 与 shared-defs.ts:75-81 重复 | 统一导出
evaluation-rules/evaluation-rules-editor.tsx:188,191,213,597,4615-4662,4664-4674 | P3 | 死代码 | methodInstanceCounts 恒 {}、setPaperDetailOpen 未使用、allQuestions 恒空查详情永远空白、showAddQuestion 无入口 | 删除相关状态
evaluation-rules/evaluation-rules-editor.tsx:670-678 | P3 | 重复定义 | EvalPointField 与 types.ts:42-49 重复 | 统一引用
evaluation-rules/evaluation-rules-editor.tsx:246-296,299-320,3104-3143 | P3 | 性能/稳定性/一致性 | reviewSteps effect 依赖 store 对象；setState-in-updater 反模式；编辑模板点保存未持久化 | 修正
evaluation-rules/bank-question-selector-panel.tsx:61-71,95-114,116-129,97-114 | P3 | 类型/性能 | any[]；无 cancelled 守卫；逐题 questionApi.get N 并发 | 补类型/守卫/批量
evaluation/bank-form-dialog.tsx:246,213-231 | P3 | 一致性 | 提交无 loading 防重复；编辑时批次未加载完 Select 只显示占位符 | 修正
evaluation/exam-form-dialog.tsx:246 | P3 | 一致性 | 提交无 loading | 提交中禁用
evaluation/manual-question-dialog.tsx:127-132 | P3 | 逻辑 | handleAddSelected 用 questions 而非 filteredQuestions | 用 filteredQuestions
evaluation/question-form-dialog.tsx:235-245,277-297,100-117 | P3 | 校验/稳定性 | 单选多选无必选答案校验；setState-in-updater；knowledgeApi.list catch 空 | 修正
evaluation/random-question-dialog.tsx:68,70-93 | P3 | 死代码/性能 | loadingQuestions 从未读取；打开即拉全量 limit 10000 | 删除/分页
evaluation/score-config-dialog.tsx:44-54 | P3 | 稳定性 | 初始化 effect 依赖 types 每次派生，外部引用变化重置用户输入 | 仅首次打开初始化
evaluation/evaluation-list-table.tsx:53-68 | P3 | 类型/一致性 | (b:any) 断言；全选语义不一致 | 统一
auth-provider.tsx:59-82,129-130 | P3 | 稳定性/代码质量 | fetchMe 无 token 不清 error；catch 展示 err.message 可能暴露细节；注释与实现不符 | 修正
chunk-error-handler.tsx:11-19,52 | P3 | 稳定性/耦合 | chunk 失败直接 reload 可能循环；文案硬编码"图谱组件" | 限制次数/参数化
job/position-builder/ai-assisted-2/step3-result-table.tsx:42,65-70 | P3 | 死代码 | aiNotice 恒 null | 删除
job/position-builder/step-ability-modeling.tsx:88,508-513,110-119,198-209,429-435,364-372 | P3 | 死代码/稳定性/逻辑 | aiNotice 恒 null；effect 无清理；bind-${Date.now()} 同毫秒冲突；Escape 触发保存；删除公共能力点可能被引用 | 修正
job/position-builder/step-basic-info.tsx:78,164-169,234-275,755-771,793-796 | P3 | 死代码/功能占位/一致性 | setLibraryLoading 未用；AI 生成假提示；新证书不同步 selectedCertIds；URL.createObjectURL 从不 revoke | 修正
job/positions/position-list.tsx:73,154 | P3 | 空值 | positions.length===0 return null 无空态；collaborators.length 未判空 | 判空
job/student/job-home.tsx:88-99,150-161,428-465,662-681 | P3 | 性能/命名/死功能 | 每场景串行 taskApi.list；majorCount: totalTasks 语义错误；目标推荐岗位卡片静态空态 | 修正
job/student/job-card.tsx:37-39 | P3 | 安全 | backgroundImage url('${coverImage}') 用户可控 CSS 注入 | 校验 URL 或 <img>
job/student/cert-cards.tsx:44-49,122-127 | P3 | 安全 | 同 backgroundImage 拼接；放大图裸 <img> | 校验 URL/next/image
job/student/scene-card.tsx:36-38 | P3 | 安全 | backgroundImage url 拼接 | 同上
job/student/platform-footer.tsx:12-71 | P3 | 合规 | 页脚写死假占位（400-888-8888、support@example.com、假ICP）| 接真实配置
portal/footer.tsx:15,41-63,79-80 | P3 | 合规/重复代码 | 与 platform-footer 完全重复且假占位 | 抽公共组件
job/student/learning-path.tsx:109 | P3 | 死代码 | DEFAULT_STEPS 分支被提前 return 遮蔽 | 删除或调整
job/student/duty-table.tsx:62-66 | P3 | 逻辑 | 职责数量用 responsibilities.length || requirements.length 误显示 | 分开展示
job/student/position-header.tsx:197-204 | P3 | 死功能 | 分享按钮无 onClick | 接入或移除
job/student/stats-bar.tsx:73,81 | P3 | 样式 | group-hover 但父级无 group | 加 group 或删 hover
job/student/competency-standards.tsx:44-57,71,84 | P3 | 逻辑 | 按职责名作 DOM id，同名职责 id 冲突 | 用职责 id
providers/data-provider.tsx:188-218 | P3 | 数据一致性 | moveQuestions 调 questionApi.update 未传 status，可能把已发布题目重置为草稿 | 补 status
portal/yi-know-assistant.tsx:597-623,746-753 | P3 | 稳定性/逻辑 | setTimeout 回复未清理；点推荐卡片仅切 tab 不退出 chat 模式 | 修正
portal/top-nav.tsx:176-183 | P3 | 死功能 | 个人中心/账号设置菜单项无 onClick | 接路由
lesson/course-evaluation-rules-dialog.tsx:48,58-73 | P3 | 稳定性 | liveConfig 取消关闭后不清空，重开时用陈旧值 | 打开时重置
scene/student/knowledge-graph.tsx:8-13,76 | P3 | 一致性 | nodeLabels 与详情组件标签不一致 | 让详情感知自定义标签
job/student/knowledge-graph.tsx:19-27,103 | P3 | 死代码 | relatedPositions 声明未使用 | 删除
knowledge-graph/graph-node-detail.tsx:234 | P3 | 逻辑 | COURSE_TYPE_LABEL[node.type] 恒返回"视频课程" | 按资源真实类型
```

## 无问题文件（15个）
evaluation-rules/types.ts、evaluation-rules/index.ts、evaluation-rules/utils.ts、knowledge-graph/types.ts、knowledge-graph/graph-data-context.tsx、knowledge-graph/graph-node-detail.tsx、platform-shell/index.ts、platform-shell/PlatformShell.tsx、global-api-error-handler.tsx、evaluation/question-preview.tsx、job/student/overview-tab.tsx、job/student/stats-box.tsx、job/student/ability-point-card.tsx、job/student/ranking-list.tsx、scene/scenarios/scenario-list.tsx

总行数 18720（P2×9，P3×62，无 P0/P1）
