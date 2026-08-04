# 中间件+路由审查（16文件，2147行）

## P1
```
backend/internal/router/routes.go:125,128-131,134-140,143-145 | P1 | 路由一致性/越权 | jobViewer(含学生) 注册的只读 GET 与 businessUser 组重复注册，chi v5.3.1 对同 method+pattern 静默覆盖、后注册者胜出（businessUser 组在 routes.go:179-193 更晚注册），导致这些面向学生的只读路由被整体替换为 businessUser 门禁，学生的课程落地页/资源库/岗位详情/收藏全部失效（POST favorite 连菜单豁免都不适用，学生必 403）。重复清单：GET /lesson/courses[/{id}](routes_lesson.go:6)、GET /library/resources[/{id}](routes_library.go:6-7)、GET /library/on-site-questions[/{id}](routes_library.go:12-13)、GET /job/position-responsibilities[/{id}](routes_job.go:23-24)、GET /job/position-abilities(routes_job.go:18)、GET /job/ability-domains[/{id}](routes_job.go:41,43)、GET /job/position-certificates[/{id}](routes_job.go:29-30)、GET/POST /job/positions/{id}/favorite(routes_job.go:9-10)、GET /job/positions/favorites(routes_job.go:11) | 删掉 jobViewer 组中的重复注册，保留唯一一份并明确其挂载角色组；或对同路径只在一处注册
backend/internal/router/router.go:122 | P1 | 安全(未鉴权/越权) | /uploads/{filename} 完全公开无鉴权，任意租户上传的 pdf/docx/csv 等（含学生数据/试卷/机构资料）只要知道 UUID 文件名即可跨租户访问（扩展名白名单+路径穿越防护已有，但无登录/租户校验） | 给 Serve 挂 JWT+租户校验，或至少对敏感类型限制；明确上传目录的公开定位
```

## P2
```
backend/internal/middleware/auth.go:76-95 | P2 | 鉴权安全 | token 有效期 7 天，RoleCodes/Permissions/TenantID 全部内嵌且请求期间不向 DB 复核：用户被停用/删除、角色被收回、租户被停用后，旧 token 最长 7 天仍可调用业务接口，无吊销/无刷新机制 | 增加 per-request 用户状态/租户复核（如 me 流程），或缩短有效期+刷新令牌
backend/internal/middleware/rbac.go:39-63 | P2 | 越权(边界) | RequireRoleOrMenu 的菜单豁免=「有任意一个已授权菜单」即可 GET 全部业务只读接口，例如有任意菜单的学生可 GET /evaluation/exam-results(routes_evaluation.go:35 全量结果 List)、/affairs/schedules、/evaluation/portraits(routes.go:161) 等，完全依赖 handler 内部按 userID 过滤，任一 handler 漏过滤即跨用户泄露 | 菜单豁免改为按菜单路径白名单精确映射到具体接口，而非全组 GET 放行
backend/internal/router/routes.go:43 | P2 | 安全(未限流) | /auth/select-tenant 为公开接口但未挂登录限流（登录接口均有 30/min 限制），虽有预授权 token+nonce 防重放，仍可被高频枚举/爆破 | 同样挂 loginLimiter
backend/internal/router/routes.go:39-42 | P2 | 性能/安全 | 登录限流键为 RemoteAddr 的 IP（cache/middleware.go:102），因刻意不信任 X-Forwarded-For，部署在反代/LB 后所有真实用户共享同一个计数（30/min 全局锁死）或单 IP 打满 | 引入可信反代头白名单或改按其他维度限流
backend/internal/router/routes.go:51 | P2 | 越权(边界) | businessUser 含 enterprise_mentor，可对课程/场景/考试/题库等执行 registerContentRoutes 全量写操作（含 submit/review/publish/archive），企业导师是否应有内容发布/审核权需确认 | 若不应，将企业导师拆到只读角色组
backend/internal/router/routes_affairs.go:55 | P2 | 边界(超时) | GET /affairs/schedules/export 不在 routes.go:24-26 的 10min 豁免前缀（/api/v1/export/）内，大租户排课导出会吃 30s middleware.Timeout 被截断成 503 | 将该路径纳入 export 豁免，或改用 POST /export/schedules 风格
```

## P3
```
backend/internal/middleware/auth.go:76-95 | P3 | 稳定性 | GenerateToken 直接解引用 input.User，传 nil 会 panic，无防御 | 加 nil 校验
backend/internal/middleware/oplog_buffer.go:58-61 | P3 | 稳定性 | Shutdown() 无超时地阻塞等待 <-b.done，极端情况下 flushLoop 卡在 SendBatch（虽有 10s ctx）会拖住优雅停机 | 加超时或日志
backend/internal/middleware/oplog.go:72 | P3 | 死代码/风格 | opLogSkips 的 "/view" 用 strings.Contains 匹配，当前没有任何路由路径含 /view（preview 不含 /view 子串），属无效条目；将来新增含 /view 的路径会静默跳过审计日志 | 改为按路径段精确匹配
backend/internal/middleware/oplog.go:74-82 | P3 | 性能 | statusRecorder 未实现 http.Flusher/Hijacker/io.ReaderFrom，对下载/流式响应有性能损耗 | 透传可选接口
backend/internal/router/routes.go:200-201 | P3 | 死代码 | /auth/me 与 /auth/saas/me 两个路径指向同一 SaasMe，疑为历史遗留冗余 | 保留一个
backend/internal/router/routes.go:230-245 + routes_affairs.go:22-26 | P3 | 路由一致性 | 工作流存在两套路由树：/workflows(RequireRoleOrMenu SchoolAdmin/Teacher) 与 /affairs/workflows(businessUser，额外含 EnterpriseMentor/PlatformAdmin)，同一 handler 角色门不一致 | 归拢为一套
backend/internal/router/handlers.go:194,223 | P3 | 命名/复用 | courseBatchHandler/affairsBatchHandler 都注入 positionSvc（NewCourseBatchHandler(positionSvc)/NewAffairsBatchHandler(positionSvc)），疑似复制粘贴走错 service，需确认未误用岗位服务 | 核对构造参数
backend/internal/middleware/rbac.go:169-189 | P3 | 越权(边界) | RequireUserRead 允许 teacher 角色拉取租户全量用户列表/详情，教师查看全部用户信息是否符合预期需确认 | 确认或收窄角色
backend/internal/router/router.go:133-135 | P3 | 风格 | /health 返回 JSON 但未设置 Content-Type: application/json | 补上 header
```

## 无问题文件
- backend/internal/middleware/auth_test.go
- backend/internal/middleware/platform.go
- backend/internal/middleware/platform_test.go
- backend/internal/router/routes_evaluation.go
- backend/internal/router/routes_scene.go

总行数 2147
