-- 094 down: 回滚课程评价下游执行链路的表结构变更

DROP TABLE IF EXISTS course_homeworks;

ALTER TABLE schedule_entries
    DROP COLUMN IF EXISTS course_id;
