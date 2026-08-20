SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE alliance_agreements DROP COLUMN created_by;
ALTER TABLE alliance_experts DROP COLUMN created_by;
ALTER TABLE alliance_achievements DROP COLUMN created_by;
ALTER TABLE alliance_projects DROP COLUMN created_by;
ALTER TABLE alliance_enterprises DROP COLUMN created_by;

ALTER TABLE alliance_experts DROP COLUMN organization;

SET FOREIGN_KEY_CHECKS = 1;