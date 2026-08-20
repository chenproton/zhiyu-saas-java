-- lesson_batches.status DB 默认值 'active' 与 Go 侧 open/closed 状态不一致：
-- 绕过 handler 的插入（种子/脚本）会得到 'active'，与 open/closed 两态冲突。
-- 默认值改为 'open'（与 Go 侧 LessonBatchStatus 默认状态一致）。
ALTER TABLE lesson_batches ALTER COLUMN status SET DEFAULT 'open';
