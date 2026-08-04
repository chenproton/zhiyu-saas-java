# 前端 packages 批次1 审查（55文件，6637行）

## P1
```
packages/api-client/src/api/alliance.ts:35-39 | P1 | 逻辑bug/数据丢失 | togglePublic 只发送 { isPublic } PUT 到 /alliance/enterprises/{id}，而后端 UpdateEnterprise 全列覆盖（非指针字段写空），调一次即清空企业记录 | 改专用 toggle 端点，或后端指针字段部分合并，或前端回读全量再 PUT
packages/api-client/src/api/alliance.ts:145-149 | P1 | 逻辑bug/数据丢失 | toggleEnabled 只发送 { isEnabled }，后端 UpdatePermission 全列覆盖，会清空 account_name/account_type/resource_permissions/platform_permissions | 同上
```

## P2（摘要）
```
packages/api-client/src/api/alliance.ts:23-32,45-54,... | P2 | 类型安全 | 全部 update 签名用 Partial<...>，但后端 PUT 为全列覆盖，部分更新静默清空未传字段 | 类型改全量或后端支持部分更新
packages/api-client/src/api/affairs.ts:206-209 | P2 | 下载处理 | exportExcel 不检查 res.ok，后端 400 时把错误 JSON 当 .xlsx 下载 | 非 2xx 抛错再下载
packages/api-client/src/api/system.ts:71-78 | P2 | 逻辑bug/死参数 | approvalApi.review 发送 nextStepIdx，后端 ReviewApprovalRequest 仅含 action/remark，stepIdx 永远无效 | 删除或对齐
packages/shared-types/src/evaluation-exam.ts:76-77,106,153-154 | P2 | 类型安全 | createdAt/updatedAt 声明为 Date，JSON API 实际返回字符串，api-client 不转换 | 统一为 string（certificate-issuance/evaluation-scene/graduation/portrait/shared-models 同类）
packages/api-client/src/api-helpers.ts:122-133 | P2 | 安全 | token 存 localStorage（zhiyu-token/zhiyu-portal-token），XSS 即可窃取；401 整页跳转粗暴 | httpOnly cookie 或降级 P3
packages/api-client/src/api/auth.ts:16-17 | P2 | 平台/token 错配 | me/saasMe 用 request()（默认 portal token）访问仅限 saas 平台路由 /auth/me、/auth/saas/me | 改用 saasRequest 或移除
```

## P3（摘要）
```
api-helpers.ts:46 | P3 | 代码质量 | 跨包相对导入 ../../shared-types 绕过包边界 | 从 @zhiyu/shared-types 导入
api-helpers.ts:148-196 | P3 | 性能/稳定性 | 无 AbortController/超时；fetch 网络错误不归一化不进 globalErrorHandler | 增加超时/abort
api-helpers.ts:178-179 | P3 | 稳定性 | hasBody 依赖 content-length，chunked/无该头空响应走 res.json().catch 强转 T | 按状态码判断
api-helpers.ts:1,128-130 | P3 | 兼容性/类型 | 顶层 process.env 脱离 Next 报 ReferenceError；NEXT_PUBLIC_DEFAULT_PLATFORM 无校验强转 | 守卫/校验
api-factory.ts:6-34 | P3 | 类型安全 | TCreate 强制要求服务端派生字段（status/questions/version 等），调用方被迫传空值 | 独立精简 create 类型
api/evaluation.ts:139-169 | P3 | any 滥用 | submit/grade/batchGrade 大量 Record<string,any>（scene.ts:75、system.ts:20 同类）| 细化类型
shared-types/evaluation-rules.ts:295-297 | P3 | 逻辑bug | methodsToEvalRuleConfig 在空值守卫前先 methods.map，null 抛错，守卫是死代码 | 先判空再 map
shared-types/status.ts:12 | P3 | 一致性 | pending 文案"审核中"与 content-status.ts:8"审批中"不一致 | 统一
shared-types/index.ts:1-22 | P3 | 导出完整性 | 未导出 lesson-source/job-source/scene-mock，certification.ts 依赖 job-source 包外无法引用 | 补导出
api-client/types/index.ts:1-9 | P3 | 导出完整性 | 未 re-export types/lesson-source，SystemCourseNode 包外不可见 | 收敛
api.ts:1 + index.ts:2 | P3 | 重复导出 | api-helpers 导出两次 | 去重
api/portal.ts:13-39 | P3 | 冗余 | userManagementApi 与 portalUserManagementApi 功能等价 | 合并
api/import-export.ts:32,48,62,88,126 | P3 | URL注入 | entity 未 encodeURIComponent | 编码
api/import-export.ts:31-33,131-190 | P3 | 错误处理 | export 返回原始 Response 不校验 res.ok | 统一封装
api/lesson.ts:104 | P3 | 类型安全 | 泛化参数丢失约束 | 具名字段
api/affairs.ts:78 | P3 | 类型安全 | status: string 过宽 | 收窄字面量联合
status.test.ts:1-17 | P3 | 测试质量 | 仅 2 例 | 参数化补充
api-helpers.test.ts:4-17 | P3 | 测试质量 | 仅 3 例 buildQuery | 补充特殊字符
```

## 无问题文件
api/library.ts、api/scene.ts、api-factory.ts、api/api.ts、api/index.ts、types/affairs.ts、types/alliance.ts、types/backend.ts、types/evaluation.ts、types/job.ts、types/lesson.ts、types/lesson-source.ts、types/library.ts、types/portal.ts、types/scene.ts、shared-types/ai.ts、approval.ts、backend.ts、certification.ts、content-status.ts、evaluation.ts、evaluation-scene.ts、graduation.ts、job-source.ts、job.ts、lesson-source.ts、lesson.ts、library.ts、online-classroom.ts、portal.ts、portrait.ts、scene.ts、scene-mock.ts、shared-models.ts、affairs.ts、alliance.ts、evaluation-exam.ts（含 Date 字段问题）

总行数 6637
