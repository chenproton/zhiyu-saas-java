-- 教学计划接入内容管理通用架构：批次绑定 / 共建人 / 创建人 / 更新时间
ALTER TABLE teaching_plans ADD COLUMN batch_id CHAR(36) REFERENCES affairs_batches(id);
ALTER TABLE teaching_plans ADD COLUMN collaborators JSON NOT NULL DEFAULT (JSON_OBJECT());
ALTER TABLE teaching_plans ADD COLUMN created_by CHAR(36);
ALTER TABLE teaching_plans ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
