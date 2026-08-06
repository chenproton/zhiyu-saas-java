-- 教学计划接入内容管理通用架构：批次绑定 / 共建人 / 创建人 / 更新时间
ALTER TABLE teaching_plans ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES affairs_batches(id);
ALTER TABLE teaching_plans ADD COLUMN IF NOT EXISTS collaborators UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE teaching_plans ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE teaching_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
