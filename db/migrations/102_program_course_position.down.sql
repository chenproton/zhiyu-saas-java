SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
CALL drop_all_fks('training_program_courses');ALTER TABLE training_program_courses DROP COLUMN position_id;
ALTER TABLE training_program_courses ADD COLUMN scenario_id CHAR(36) REFERENCES scenarios(id);

SET FOREIGN_KEY_CHECKS = 1;