SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP INDEX idx_scenarios_source_enterprise ON scenarios;
ALTER TABLE scenarios DROP CHECK scenarios_source_type_check;
ALTER TABLE scenarios DROP COLUMN source_enterprise_id;
ALTER TABLE scenarios DROP COLUMN source_type;

DROP INDEX idx_career_positions_source_enterprise ON career_positions;
ALTER TABLE career_positions DROP CHECK career_positions_source_type_check;
ALTER TABLE career_positions DROP COLUMN source_enterprise_id;
ALTER TABLE career_positions DROP COLUMN source_type;

SET FOREIGN_KEY_CHECKS = 1;