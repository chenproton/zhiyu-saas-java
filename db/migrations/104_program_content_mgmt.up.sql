-- 为 training_programs 添加内容管理所需字段
ALTER TABLE training_programs ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(id);
ALTER TABLE training_programs ADD COLUMN IF NOT EXISTS collaborators UUID[] NOT NULL DEFAULT '{}';
