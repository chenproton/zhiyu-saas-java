-- 联盟关联体系增强：专家所属机构 + 主表创建人
ALTER TABLE alliance_experts ADD COLUMN IF NOT EXISTS organization TEXT;

ALTER TABLE alliance_enterprises ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE alliance_projects ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE alliance_achievements ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE alliance_experts ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE alliance_agreements ADD COLUMN IF NOT EXISTS created_by UUID;
