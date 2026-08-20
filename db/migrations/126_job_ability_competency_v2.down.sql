SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE job_ability_results
    DROP COLUMN position_competency_v2;

SET FOREIGN_KEY_CHECKS = 1;