-- 联盟关联体系增强：专家所属机构 + 主表创建人
ALTER TABLE alliance_experts ADD COLUMN organization TEXT;

ALTER TABLE alliance_enterprises ADD COLUMN created_by CHAR(36);
ALTER TABLE alliance_projects ADD COLUMN created_by CHAR(36);
ALTER TABLE alliance_achievements ADD COLUMN created_by CHAR(36);
ALTER TABLE alliance_experts ADD COLUMN created_by CHAR(36);
ALTER TABLE alliance_agreements ADD COLUMN created_by CHAR(36);
