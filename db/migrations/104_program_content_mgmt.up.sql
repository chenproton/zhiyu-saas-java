-- 为 training_programs 添加内容管理所需字段
ALTER TABLE training_programs ADD COLUMN batch_id CHAR(36) REFERENCES batches(id);
ALTER TABLE training_programs ADD COLUMN collaborators JSON NOT NULL DEFAULT (JSON_OBJECT());
