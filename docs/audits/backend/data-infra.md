# 数据基础设施审计

## 核心决策

- **文件上传**：
  - multipart 上传，最大 100MB。
  - 白名单扩展名：pdf/doc/docx/ppt/pptx/xls/xlsx/txt/mp4/mov/avi/mkv/webm/mp3/wav/ogg/jpg/jpeg/png/gif/webp/zip/rar/7z。
  - 文件保存为 `<UUID>.ext`，返回 `/uploads/<filename>` 路径。
  - `Serve` 接口含路径穿越防护。
- **文件预览**：`Preview` 接口通过 LibreOffice headless 转换 Office 文件，支持 HTML/PDF/PNG 三种格式，转换后清理临时目录。
- **数据导出**：CSV 格式，支持 5 种实体（题库/试卷/课程/岗位/场景），最多 1000 行。
- **数据导入**：解析 CSV，仅提取 `name` 和 `code`，使用预定义 INSERT 语句。
- **登录日志**：支持按用户、状态筛选，租户隔离。
- **操作日志**：支持按用户、模块、动作筛选，租户隔离。
- **平台配置**：`platform_configs` 表存储 `platform_fee_rate` 和 `min_withdrawal_amount`。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 文件上传 | PASS | 100MB 上传；白名单扩展名；UUID 命名；路径穿越防护 |
| 文件预览 | PASS | LibreOffice headless 转换；HTML/PDF/PNG 三种格式 |
| 文件访问 | PASS | `/uploads/{filename}` 路径 |
| 数据导出 | PASS | CSV 格式；5 种实体；流式输出 |
| 数据导入 | PASS | CSV 解析；预定义 INSERT |
| 登录日志 | PASS | 租户隔离；分页查询 |
| 操作日志 | PASS | 租户隔离；分页查询 |
| 平台配置 | PASS | key-value 存储 |

## 风险与约束

- **文件上传无病毒扫描**：上传文件仅限扩展名，不验证文件内容真实性。—— **高危，建议引入文件内容扫描。**
