-- 回滚：恢复 'active' 默认值（迁移 141 前行为）。
ALTER TABLE lesson_batches ALTER COLUMN status SET DEFAULT 'active';
