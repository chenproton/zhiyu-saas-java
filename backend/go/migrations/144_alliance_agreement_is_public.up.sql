-- alliance_agreements 增加"前台显示"开关：公开展示唯一门槛简化为 is_public，
-- 不再以 status（draft/active 等业务状态）作为展示过滤条件。
ALTER TABLE alliance_agreements ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
