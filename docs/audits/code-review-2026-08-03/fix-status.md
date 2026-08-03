# P0/P1 修复状态记录（分支 feat/code-review-fix-p0p1，2026-08-04）

> 依据 `problems.md` 问题清单，本轮修复范围：P0 × 2（其中 1 条经回查降级）+ P1 × 58。
> 全部修改已通过本地验证：`gofmt -l`、`go vet`、`go build`、后端 `go test`、前端 `pnpm typecheck`、`pnpm lint`、`pnpm test`。

## 已修复（57 项）

| 提交 | 内容 |
|------|------|
| `9a11ee0a` | **P0**：课程克隆 `node_knowledge_point_bindings` 插入不存在的 tenant_id 列（克隆必崩）修复；resource bindings 插入对齐（该表实有 tenant_id 列，原 P0 降级） |
| `291f0c72` | **越权**：alliance 7 个 store UPDATE 补租户过滤（achievement/agreement/brand/enterprise/enterprise_agreement/expert/project）；certificate_library 与 random_draw_questions 的 Get/Update/Delete 租户限定；岗位证书 Get/Update/Delete 按岗位归属校验；enterprise/permission 部分更新合并防全列覆盖清空（含前端 togglePublic/toggleEnabled 数据丢失根因） |
| `6725ffef` | **鉴权/越权**：学生只读路由移出被 businessUser 覆盖区间（chi 后注册胜出）；题库 Get 改租户限定；现场问答题学生视角隐藏 answer/score；岗位导出 6 处查询补租户过滤；方案课程导入校验方案归属+岗位/课程匹配租户过滤；课程资源创建校验课程租户；认证点挂任务校验归属；批量建用户响应脱敏（PasswordHash/IDCard/Oauth） |
| `285c1566` | **逻辑bug**：无工作流审批单步直通（原永久卡死）；审批历史 stepIdx int/float64 双类型断言；课程更新 batchId 缺省回退；CSV 导入改从 FormFile 句柄解析（原必败）；颗粒课导入 preview 模式不再写库；教学计划生成回读错误不再 nil 解引用 panic；模板生成 nil 文件 writeExcel 兜底；证书等级 last_updated 按 *time.Time 扫描（原二进制协议必失败恒空）；seed 平台管理员 role 语义修正 |
| `b3d43412` | **并发/事务**：用户关系搜索 count 查询补 JOIN（原带搜索必 500）；任务更新租户不匹配不再回读他租户数据（RowsAffected 校验）；课程节点/知识点事务内回读改用 tx（原读不到未提交行）；节点作业批改+评价结果同步并入事务；课程删除级联清理包事务；自动排课插入事务内加 advisory 锁；岗位能力汇聚锁不再"用完即删"（破坏互斥）；测评方式保存版本检查移入事务+advisory 锁（原双提交静默覆盖） |
| `d11e5779` | **前端**：考试安排创建/开始/结束/删除补错误处理；评分保存失败提示与加载错误区分；题库归档只读；任务权重持久化（后端接口已存在未接线，现加载+保存打通）；任务编辑器模块级单例改组件状态（防多会话串数据）；保存失败不再跳转（granular/system add）；混合课编辑树根名称同步；渲染期不再 setState；教学资源选择保留 url；成果"前台展示"开关实现；套餐错误重试重新请求；教师课程类型按 courseId 判定（原 index%2 与数据无关）；CSV 导入重复确认弹窗修复（原流程卡死）；教学计划教师变更失败提示；能力汇聚轮询链防交叉 |

## 经核实无需修改（3 项）

| 问题 | 结论 |
|------|------|
| `/uploads/{filename}` 公开无鉴权 | 保持现状：前端 `<img>/<iframe>` 无法携带 Authorization，且公开落地页与其他子平台依赖直出；UUID 文件名 + 扩展名白名单已有基础防护。按"简单优先/容忍 hacker"原则记为已接受风险 |
| `courseBatchHandler/affairsBatchHandler` 注入 positionSvc | 经核对 `NewBatchHandler(svc batchService, ...)`，PositionService 实现通用 batchService 接口，注入正确，非复制粘贴错误 |
| landing/exams"我的考试"按"进行中"过滤 | 后端 `computeExamStatus` 实际返回中文状态，"进行中"过滤有效；"按本人过滤"属功能缺口，需要后端新接口，超出 P1 修复范围 |

## 未修复项（仍属 P2/P3 或需后端新功能）

- 其余 P2 × 246、P3 × 477 按本轮范围（P0+P1）留待后续批次
- 任务权重"锁定"标记不持久化（后端仅存 weight 字段，locked 为编辑期状态）
