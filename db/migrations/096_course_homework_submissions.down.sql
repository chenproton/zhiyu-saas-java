SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
CALL drop_all_fks('course_homework_submissions');DROP INDEX idx_course_hw_sub_unique ON course_homework_submissions;
DROP INDEX idx_course_hw_sub_student ON course_homework_submissions;
DROP INDEX idx_course_hw_sub_homework ON course_homework_submissions;
DROP INDEX idx_course_hw_sub_course ON course_homework_submissions;
DROP INDEX idx_course_hw_sub_tenant ON course_homework_submissions;
DROP TABLE IF EXISTS course_homework_submissions;

SET FOREIGN_KEY_CHECKS = 1;