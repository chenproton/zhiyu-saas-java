-- 094 down: 回滚课程评价下游执行链路的表结构变更

SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
CALL drop_all_fks('schedule_entries');DROP TABLE IF EXISTS course_homeworks;

ALTER TABLE schedule_entries
    DROP COLUMN course_id;

SET FOREIGN_KEY_CHECKS = 1;