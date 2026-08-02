# 全量代码审查（2026-08-03）

对本仓库前后端全部代码（745 文件 / 约 17.5 万行）的逐行完整审查成果。**逐个文件完整阅读，未做任何抽样**；审查后对问题清单逐条回查验证（重新阅读代码确认存在性、校正位置、补充最佳实践方案）。

## 文档导航

| 文档 | 内容 |
|------|------|
| [checklist.md](checklist.md) | 前后端全部 745 个文件清单（已全部勾选完成） |
| [problems-backend.md](problems-backend.md) | 后端问题清单（283 文件，约 600 条） |
| [problems-frontend.md](problems-frontend.md) | 前端问题清单（462 文件，约 800 条） |
| [problems-verification.md](problems-verification.md) | **回查验证报告**：逐条核实问题存在性 + 代码位置校正 + 最佳实践解决方案（含 3 处误报更正） |

## 核心结论（详细见 problems-backend.md 第 0 节）

1. **跨租户越权（IDOR）是全局最高优先级缺陷**：约 40+ handler 的 Get/Update/Delete 不校验实体租户归属，store 层约 60+ 方法 `WHERE id=$1` 无 tenant 条件。学生可达路由中 `scenario/course-node/ability/knowledge-point` 等详情接口可直接跨租户读草稿数据。
2. **6 处必炸 SQL**（certifications ListFullItems / resource_codes Create / teaching_plans FetchProgramCourses / scenarios Delete / node_evaluation_results 空参 / batch_configs 搜索歧义）——均经代码核实。
3. **静默吞错泛滥**（导出缺行仍 200、导入半覆盖、`catch {}` 显示"暂无"），前后端合计约 60+ 处。
4. **前端大量硬编码假数据/死按钮**（教师课表、工作台统计、社区、收藏、荣誉、AI 助手答复、页脚联系方式等），生产路径仍为占位实现。
5. 已更正 3 处误报（AttachRoles 回写正常、shared-types barrel 无编译冲突、前端 tsc 全局通过），详见 verification 文档 E 节。

## 修复顺序建议

- **P0**：IDOR 全量修复（verification B 节统一方案）→ 6 处必炸 SQL（A 节逐条方案）→ /uploads 无鉴权 + 上传类型白名单 + multipart 临时文件泄漏
- **P1**：approval fail-open、限流 IP 伪造、import/export 参数错位、portal role 信任、前端 XSS（d3 tooltip）
- **P2**：导出/导入静默缺行、rows.Err() 补全、service 值副本、契约漂移（saasMe token、saveFull 类型、achievements 单复数）
- **P3**：假数据清理、a11y、as any 收口、测试补强（越权用例 + A1-A6 执行级测试 + setup.go DSN 回退移除）

> 审查遵循项目契约：未修改任何代码；此目录为纯文档交付（AGENTS.md 允许直接提交）。
