# 前端 app 批次1 审查（58文件，15695行）

## P1
```
apps/edu/app/evaluation/exam-usage/page.tsx:141-165 | P1 | 错误处理 | handleCreate 无 try/catch：失败时未处理 rejection，且 createSubmitting 卡死为 true | 加 catch + finally
apps/edu/app/evaluation/scene-results/[id]/page.tsx:1016-1018 | P1 | 错误处理 | handleSave 失败被空 catch 吞掉，无错误提示、无回滚，用户误以为已保存 | 至少 toast 失败并保留现场
```

## P2（摘要）
```
apps/edu/app/affairs/programs/[id]/_components/courses-tab.tsx:94-106 | P2 | 性能 | 逐个岗位串行请求 scenarioApi.list（瀑布请求）| 改 Promise.all 并行
apps/edu/app/affairs/programs/[id]/_components/courses-tab.tsx:122 | P2 | 稳定性 | 岗位分组行 key 用 pos-${pid}-${Date.now()}，每次 loadCourses 生成新 key 导致整行重挂载（输入焦点丢失）| 用稳定 key
apps/edu/app/affairs/programs/[id]/_components/program-course-import-dialog.tsx:84-86 | P2 | 错误处理 | 预览接口失败时 catch 吞错并静默直接导入，绕过重复检测/校验 | 预览失败应提示并终止
apps/edu/app/affairs/scheduling/_components/schedule-grid-tab.tsx:80-94 | P2 | 稳定性 | loadScheduleEntries 无取消/请求序号，切换学期时旧响应可能覆盖新数据 | 加 cancelled 标志或 AbortController
apps/edu/app/affairs/scheduling/_components/schedule-grid-tab.tsx:87-88 | P2 | 性能 | 明确 TODO：limit 200 + 前端场地筛选，超 200 条筛选不完整 | 改服务端筛选/分页
apps/edu/app/affairs/scheduling/_components/timetable-view-tab.tsx:50-64 | P2 | 稳定性 | params 为空时提前 return 未处理在途请求，清空选择后旧响应可能回填 | 加取消标志
apps/edu/app/affairs/scheduling/page.tsx:43 | P2 | 逻辑 bug | setPlanId(prev => prev || targetId)：URL ?planId= 只在首次生效，同页面切换 query 不切换计划 | 直接 setPlanId(targetId)
apps/edu/app/affairs/teaching-plans/[id]/page.tsx:118-125 | P2 | 错误处理/一致性 | 教师变更即时调 updateEntry 但 catch 为空：失败静默；handleSaveAll 不含 teacherId，并发写同一条目竞态 | 提示失败并纳入统一保存流程
apps/edu/app/evaluation/exams/[id]/page.tsx:187-191 | P2 | 稳定性 | handleAddQuestions 循环不 await，并发 addQuestionToExam 各自 loadExams 全量重载竞态 | 顺序 await 后统一刷新
apps/edu/app/evaluation/exams/[id]/page.tsx:223-235 | P2 | 性能 | 拖拽每经过一个目标触发一次服务端写入+全量 reload，请求风暴 | 拖拽结束统一提交
apps/edu/app/evaluation/exam-usage/page.tsx:167-188 | P2 | 错误处理 | handleStart/handleFinish/handleDelete 无 try/catch，失败为未处理 rejection 且无提示 | 补错误捕获
apps/edu/app/evaluation/job-ability/page.tsx:56-65 | P2 | 性能 | 每条规则各发一次 getFullRule（N+1 请求）| 服务端聚合或复用列表接口
apps/edu/app/evaluation/job-ability/results/page.tsx:199-265 | P2 | 稳定性 | 不同岗位连续触发汇聚时共享 aggregateTimerRef，两条轮询链交叉覆盖 | 触发前清空旧链或按岗位隔离
apps/edu/app/evaluation/landing/banks/[id]/page.tsx:110 | P2 | 性能 | questionApi.list limit 10000 一次拉全库题目，无分页且 as any | 分页/虚拟滚动
apps/edu/app/evaluation/landing/exams/page.tsx:57 | P2 | 逻辑 bug | 「我的考试」仅按中文状态串 '进行中' 过滤，既非按人过滤又与后端英文状态不一致 | 用真实用户/考试安排接口
apps/edu/app/evaluation/landing/page.tsx:218-222 | P2 | 性能 | 分页只作用于题库，试卷全部渲染（无分页）| 试卷同样分页
apps/edu/app/evaluation/question-banks/[id]/page.tsx:186 | P2 | 越权 | canEdit 恒为 true，无权限/状态校验即允许编辑任意题库 | 结合权限与状态判定
apps/edu/app/evaluation/question-banks/[id]/page.tsx:291-296,316-341,362-366 | P2 | 错误处理 | delete/copy/move 均为 fire-and-forget，失败静默且可能未处理 rejection | await 并补错误提示
apps/edu/app/evaluation/scene-results/[id]/page.tsx:880-882 | P2 | 错误处理 | 主加载 catch 空吞，任何错误都显示「记录不存在」| 区分错误并提示
apps/edu/app/evaluation/scene-results/page.tsx:285-425 | P2 | 稳定性 | TaskMethodTabs 定义在组件内部，父组件每次 re-render 都重挂载导致 activeMethod 重置 | 提升为顶层组件
apps/edu/app/job/positions/[id]/edit/page.tsx:249-252 | P2 | 逻辑 bug | handleFinish 无论 handleSave 成功与否都跳转，保存失败仍离开页面丢失数据 | 校验保存结果再跳转
```

## P3（摘要）
```
apps/edu/app/affairs/approvals/page.tsx:37,24,34 | P3 | 性能/类型 | 全量拉取 1000 条方案/批次仅做名称映射；ApprovalView.history/batchMap 用 any | 按需拉取/补类型
apps/edu/app/affairs/scheduling/_components/schedule-grid-tab.tsx:52,160 | P3 | 死代码 | savingQuick 恒 false，160 行守卫永不生效 | 删除
apps/edu/app/affairs/scheduling/_components/schedule-edit-dialog.tsx:54-62 | P3 | 逻辑 | 弹窗已打开时 entry 变化表单不回填 | useEffect 监听
apps/edu/app/affairs/scheduling/_components/schedule-import-dialog.tsx:54-60 | P3 | 死代码 | useEffect 内 async IIFE 只做同步 setState | 直接 setConfirmOpen(true)
apps/edu/app/affairs/scheduling/page.tsx:37,162-175 | P3 | 死代码/类型 | 忽略 loadingPlan；伪造 as any 的 AffairsTerm | 使用/删除、抽真实 term
apps/edu/app/affairs/teaching-plans/[id]/page.tsx:127-152 | P3 | 错误处理 | 逐条保存失败仅吞掉，toast 只显示成功数 | 汇总失败明细
apps/edu/app/evaluation/approvals/page.tsx:82-89 | P3 | 逻辑 | 用 bankRecords.includes(a) 引用相等区分记录归属，脆弱 | 用 targetType 判断
apps/edu/app/evaluation/exams/[id]/page.tsx:179-180 | P3 | 数据一致性 | canEdit 允许编辑 published/archived 试卷 | 确认业务
apps/edu/app/evaluation/exam-usage/page.tsx:76-97 | P3 | 重复代码 | loadUsages 与 useEffect 内联 load 重复 | 复用
apps/edu/app/evaluation/exam-usage/results/page.tsx:70-83,285 | P3 | 逻辑 | rank 用数组下标+1 假定有序；studentId 直接用 r.userId | 后端返回 rank/studentNo
apps/edu/app/evaluation/landing/banks/[id]/page.tsx:99-129 | P3 | 稳定性 | effect 无取消标志，卸载后可能 setState | 加 cancelled
apps/edu/app/evaluation/landing/exams/[id]/page.tsx:120-144,166-171 | P3 | 性能/稳定性 | 依赖含 currentUsage 重复拉取；duration 为空时 timeLeft 为 NaN | ref 化依赖/兜底默认时长
apps/edu/app/evaluation/landing/exams/page.tsx:38-40 | P3 | 错误处理 | catch 空吞，失败显示「暂无考试」| 加错误态
apps/edu/app/evaluation/question-banks/[id]/page.tsx:368-379,138-142,156 | P3 | 类型/安全 | createQuestion 不 await；创建人展示原始 userId；q.content.toLowerCase() 未判空 | 修正
apps/edu/app/evaluation/scene-results/[id]/page.tsx:1078 | P3 | 性能 | DrawnQuestionCard key 拼入 oralAnswers 值，每次答案变化重挂载 | 稳定 key
apps/edu/app/evaluation/scene-results/page.tsx:100,162 | P3 | 性能/类型 | taskApi.list limit 10000；map.get(pos)! 非空断言 | 分页/判空
apps/edu/app/job/positions/[id]/edit/page.tsx:181-192 | P3 | 死代码 | 拉取专业/行业字典但写入被忽略的 state | 删除
apps/edu/app/job/learn-roads/page.tsx:690,129 | P3 | 稳定性 | setTimeout 卸载未清理；orphan key 用 Math.random() | ref+cleanup/稳定 key
apps/edu/app/job/recommend/page.tsx:107-138 | P3 | 一致性 | 批量更新排序无事务，任一失败排序半应用 | 失败回滚或重试
```

## 无问题文件
affairs/batches、affairs/config、affairs/layout、venue-period-config-tab、generate-plan-dialog、entry-type-badge、teaching-plans/page、affairs/workflows、dashboard/layout、error.tsx、global-error.tsx、evaluation/batches、evaluation/exams/page、job-ability/config/[id]/page、evaluation/layout、evaluation/landing/layout、evaluation/question-banks/page、evaluation/workflows、job/approvals、job/archive、job/batches、job/layout、job/landing/layout、job/landing/page、job/positions/page（25个）

总行数 15695
