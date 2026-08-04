# store 批次2 审查（21文件，4975行）

## P0（运行时必错）
```
course_clone.go:445-448 | P0 | SQL/运行错误 | cloneNodeKnowledgeBindings 向 node_knowledge_point_bindings 插入 (id, tenant_id, node_id, knowledge_point_id)，但该表基线(001:669-674)只有 id/node_id/knowledge_point_id/created_at，无 tenant_id 列且无迁移补充；克隆任何带知识点绑定的体系课节点必然报 "column tenant_id does not exist" | 去掉 tenant_id 列（与 course_nodes.go:128 的插入保持一致）
course_clone.go:468-471 | P0 | SQL/运行错误 | cloneNodeResourceBindings 同样向 node_resource_bindings 插入不存在的 tenant_id 列（001:694-698 无该列）| 去掉 tenant_id 列
```

## P1
```
course_nodes.go:137 / 142 / 176 | P1 | 事务穿透 | Create/Update 接收 tx Queryer 却用 store 全局 s.q 调 fetchNode；事务内创建节点后回读不到未提交行 → ErrNoRows；Update 回读旧值 | 将 fetchNode 也改为按传入 tx 查询（或把 tx 存入 Store 临时字段）
lesson_content.go:75 / 94 | P1 | 事务穿透 | KnowledgePointStore.Create/Update 同样在 tx 内用 s.q 调 fetchKP，插入后回读失败 | 改用 tx 查询
course_homeworks.go:148-169 | P1 | 一致性 | GradeNodeHomework 的 UPDATE 批改与 node_evaluation_results 同步未包事务（对比 GradeCourseHomework 用了 withTxStore）；第二步失败则批改成功但评价结果缺失 | 用 withTxStore 包裹
courses.go:128-152 | P1 | 一致性 | CourseStore.Delete 跨 7 张表的解绑/删除无事务，中途失败产生半删除状态 | 用 withTxStore 包裹
```

## P2
```
course_nodes.go:180-183 | P2 | 孤儿数据 | Delete 只删节点本身，不删子节点(parent_id=id)、node_quizzes/node_homeworks/hybrid_node_modules，父子 FK 存在时删除父节点失败或留孤儿 | 级联删除子表（或由调用方在事务内清理）
lesson_content.go:98-101 | P2 | 孤儿数据 | 删除知识点不清 courses.knowledge_point_ids 数组、granular_lesson_ids、course/node 绑定表引用 | 删除前同步清理引用
lesson_content.go:261-264 | P2 | 孤儿数据 | NodeHomeworkStore.Delete 不删 node_homework_submissions，留提交记录孤儿 | 事务内级联删除
exams.go:80-86 | P2 | 一致性/孤儿 | Delete 先删题目再删试卷无事务；且不删 exam_usages/exam_results 引用，留孤儿 | withTxStore 包裹并清理引用
exam_usages.go:88-91 | P2 | 孤儿数据 | 删除考试安排不删 exam_results，考生成绩成孤儿；且无租户过滤 | 事务内删 exam_results 并加租户校验
course_assessments.go:160-162 | P2 | 错误吞没 | EnsureExamQuestions 扫描失败 continue 静默跳过题目，用户少题不报错 | 返回错误终止
exam_results.go:100-111 | P2 | 错误吞没/N+1 | FetchUserProfile 两条查询全部 _ = 忽略错误，用户不存在返回空档案；两条可并一条 JOIN | 合并为单条并处理错误
job_ability_results.go:312-313 | P2 | 数据归属 | UpsertResult ON CONFLICT DO UPDATE 用 EXCLUDED.tenant_id 覆盖既有行租户，跨租户冲突时改变数据归属 | 不更新 tenant_id
graduations.go:282 | P2 | 错误吞没 | QueryGraduationResults 的 COUNT 查询错误被 _ = 忽略，出错时 total=0 仍返回 | 检查并返回错误
landing.go:40-62 | P2 | 数据重复 | ListExams JOIN exam_usages 一对多，同一试卷多安排时重复出现；scan 失败 continue 静默丢行 | 用 DISTINCT ON 或聚合去重，scan 错误返回
```

## P3（摘要）
```
course_clone.go:133 / 160 / 440 / 465 | P3 | 错误吞没 | 各绑定克隆 scan 失败 continue | 返回错误
course_clone.go:83-96 | P3 | 一致性 | 克隆后 resource_count 恒为 0，与克隆的绑定数不一致 | 按绑定数重算
course_clone.go:52-77 / 479-509 | P3 | 越权 | FetchSource/FetchCourse 无租户过滤，依赖调用方校验 | 增加租户参数
course_assessments.go:76-79 / 250-263 | P3 | 越权/错误吞没 | UpdateNodeEvalData 无租户过滤；CleanupCourseLevelAssessments 错误 _, _= 忽略 | 校验归属/透传错误
course_assessments.go:180-198 | P3 | 性能 | EnsureExamQuestions 每题 1 次存在性查询+1 次写（N+1），且存在性查询错误 _ = | 用 EXCEPT 一次性对比或 LEFT JOIN
course_homeworks.go:171-181 | P3 | 错误吞没 | scanHomeworkSubmissions scan 失败 continue | 返回错误
course_nodes.go:199-221 / 224-246 | P3 | 越权 | KnowledgePointsByIDs/ResourcesByIDs 无租户过滤，可能跨租户回显名称 | 加租户条件
course_nodes.go:186-196 | P3 | 越权 | Reorder 无租户过滤（仅 course_id）| 传 tenantID 校验
evaluation_methods.go:69-96 / 149-159 | P3 | 越权 | Get/Toggle/Get 单查无租户过滤，依赖 handler 先调 TenantID；AppealStore.Process 的 status 未校验取值 | 归属校验集中封装
evaluation_results.go:103-128 / 149-152 | P3 | 越权 | Grade/BatchGrade/UpdateExamResultScore 仅 id 过滤，跨租户可越权改分 | 增加租户条件
exam_results.go:44-56 / 67-88 | P3 | 越权 | UsageExamInfo/FetchExamQuestions 无租户过滤 | 增加租户条件
exam_results.go:114-140 | P3 | 一致性 | SaveResult ON CONFLICT 不更新 student_name/class_name/grade/major_id，改班/改专业后旧值残留 | 冲突时一并更新
exams.go:31-40 / 65-77 | P3 | 越权 | Get/Update/Delete 无租户过滤，仅 id | 归属校验或加租户条件
exam_usages.go:59-70 / 73-97 | P3 | 健壮性 | Create 的 start_time/end_time 为字符串直插 timestamptz；Update/SetStatus 无租户过滤 | 解析校验/加租户条件
graduations.go:134-137 | P3 | 代码健壮性 | ApplyTopic 用 err.Error()=="topic full" 字符串判错，应定义哨兵错误；UPDATE 无租户过滤 | 定义 ErrTopicFull 哨兵，UPDATE 加 tenant_id
graduations.go:88-97 / 232-244 | P3 | 越权 | DeleteTopic/CreateEvaluation 等无租户过滤，仅 id | 归属校验
industries.go:41-79 | P3 | 越权 | GetByID/Update/Delete 无租户过滤；Delete 不校验子节点 | 加租户条件并调用 CountChildren 防删
job_ability_results.go:82 | P3 | 规范 | LIMIT/OFFSET 用 Itoa() 字符串拼接（值安全但非常规，limit 无上限钳制）| 用占位符传参并钳制
job_ability_results.go:341-344 | P3 | 逻辑 | RefreshRanks 按 class_name/major_id 分区，NULL 值全部归入一组 | COALESCE 处理空值
landing.go:41-47 | P3 | 越权/性能 | LATERAL 子查询不限租户/状态取任意 org；eu 未过滤 status | 增加 eu.status 与租户条件
lesson_content.go:235-244 | P3 | 重复插入 | NodeHomeworkStore.Create 无唯一约束兜底 | 依赖调用方或加唯一约束
logs.go:97 | P3 | 死代码 | var _ = context.Background 为保留 import 的 hack | 删除 import 与这行
evaluation_methods.go:112 / 205、graduations.go:371 / 385 / 405、exam_results.go:311、exams.go:295、course_nodes.go:391 | P3 | rows.Err 未检查 | 各 Scan*Rows/scanCourseNodeBaseRows 返回 items, nil 未检查 rows.Err() | 补 rows.Err()
entity_code.go:40-50 | P3 | 并发 | 唯一编码"先查后插"未加唯一索引兜底，并发下可能重复；rand 失败回退 %s-%08d | 对 (tenant_id,code) 建唯一索引并在冲突时重试
```

## 无问题文件
- backend/internal/store/hybrid_modules.go
- backend/internal/store/learn_roads.go
- backend/internal/store/lesson_behaviors.go
- backend/internal/store/content_actions_test.go

总行数 4975
