# 基础设施层对齐核对（主代理实测）

## 1. 数据库 Schema
- Go 端：backend/go/migrations/ 共 174 个迁移（up/down 配对），baseline 001 + 增量到 174_ai_kb_agent_classify，共 169 张表。
- Java 端：无 Flyway/Liquibase，业务表结构完全依赖 Go 迁移（两栈共用同一 PostgreSQL，deploy-java.sh 要求先跑 deploy.sh）。框架表走 script/sql/postgres/*.sql（ry_vue/ry_ai/ry_job/ry_workflow）。
- 实体覆盖：Java zhiyu 模块 123 个 @TableName 实体；Go 169 张表中：
  - 20 张无实体但 Mapper SQL 直接引用（banners、orders、resources、task_resources、tenant_settings、view_logs 等）——正常写法，不算缺口。
  - 27 张完全未被 Java 引用，其中大部分是 Go 侧也不再引用的历史遗留表（app_modules、authorizations、graduation_project_*、credit_conversion_rules、micro_cert_templates、cert_issuance_records、scene_archives、node_resources、platform_links、withdrawals、resource_tags 等，Go 代码引用数=0）。
  - 需关注的活跃表缺口：
    - job_run_logs（Go 定时任务执行日志）——Java 无引用，与下方定时任务缺口互为印证。
    - institutions（Go store/auth.go、resource_import_export.go 仍在读；疑旧登录/导入兼容路径，建议确认是否仍需对齐）。
- 表重命名一致性：迁移 142 已将 alliance_enterprises → partner_enterprises，Java 两侧实体（PartnerEnterprise/AllianceEnterprise）均已用新表名 ✅。

## 2. 认证与鉴权
| 能力 | Go | Java | 状态 |
|---|---|---|---|
| 登录/登出/多租户选择 | auth_handler.go（JWT） | ZhiyuAuthController + Sa-Token，公开路径集合与 Go 对齐 | ✅ |
| 逐请求用户/租户状态校验（停用即时失效） | middleware RequireActiveUser | ZhiyuAuthFilter 逐请求查库，fail-closed，401 文案对齐 | ✅ |
| 图形验证码 | captcha_handler.go | ZhiyuAuthController /api/v1/auth/captcha | ✅ |
| **菜单驱动 API 授权（ADR-0008 RequireMenu）** | middleware/menu.go，全部业务路由挂载 | **无对应物**：zhiyu 模块 0 处 @SaCheckPermission，仅少量 SystemGuard.hasRole 角色判断；菜单权限只回传前端做 UI 控制 | ❌ 服务端授权缺口 |
| 登录日志 IP 归属地 | internal/geo（ip2region）写入登录日志地点 | 框架 common-core 有 RegionUtils/AddressUtils，但 zhiyu AuthServiceImpl 未接 | ⚠️ |
| 敏感字段脱敏 | internal/mask（手机号/身份证/邮箱输出侧脱敏） | 框架有 @Sensitive 注解体系，zhiyu 侧使用情况待确认 | ⚠️ |

## 3. 定时任务
- Go：scheduler.go 每天 02:00 跑 job-ability-aggregate（岗位能力汇聚），含 job_run_logs 落库、失败重试 1 次、panic 兜底、pg advisory lock 防多实例并发、ALERT_WEBHOOK_URL 告警。
- Java：ruoyi-zhiyu 无 @Scheduled/JobExecutor；SnailJob 在 application-prod.yml 中 enabled: false；仅有手动触发接口 POST /aggregate（EvaluationJobAbilityController）。
- 结论：❌ **每日自动汇聚任务在 Java 栈缺失**（只能手动触发）。

## 4. 文件上传/下载
- Go：file_handler.go（/api/v1/files/upload、sign-url、preview、/uploads/{tenant}/{filename} 静态回源）。
- Java：ZhiyuFileController（/api/v1/files/upload、sign-url、preview）+ ZhiyuUploadsController（/uploads/{tenantId}/{filename}）✅ 路径级对齐。

## 5. 监控/日志
- Go：internal/metrics（Prometheus 指标）、operation_logs/login_logs 业务日志。
- Java：框架 monitor-admin + sys_oper_log/sys_login_info；zhiyu 业务侧 operation_logs/login_logs 表均有实体 ✅（细粒度对齐见分域报告）。

## 6. 规模对照
- Go：handler 52,885 行 / service 18,974 行；路由 688 个。
- Java zhiyu：604 个 java 文件 / 78,265 行；88 个 controller，@*Mapping 端点 726 个。
