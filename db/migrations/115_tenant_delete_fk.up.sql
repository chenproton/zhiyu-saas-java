-- MySQL 辅助存储过程：按 (表, 列, 引用表) 删除自动命名外键（PG 内联 REFERENCES 的 MySQL 自动约束名不可预测，
-- 115/116 原 PG 的 DROP CONSTRAINT IF EXISTS <列名>_fkey 无法直接对应，改用 information_schema 动态查找删除）。
DROP PROCEDURE IF EXISTS drop_fk_if_exists;
DELIMITER $$
CREATE PROCEDURE drop_fk_if_exists(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ref_tbl VARCHAR(64))
BEGIN
  DECLARE fk_name VARCHAR(64);
  SELECT CONSTRAINT_NAME INTO fk_name
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl
      AND COLUMN_NAME = col AND REFERENCED_TABLE_NAME = ref_tbl
      AND CONSTRAINT_NAME <> 'PRIMARY'
    LIMIT 1;
  IF fk_name IS NOT NULL THEN
    SET @s = CONCAT('ALTER TABLE ', tbl, ' DROP FOREIGN KEY ', fk_name);
    PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS drop_all_fks;
DELIMITER $$
CREATE PROCEDURE drop_all_fks(IN tbl VARCHAR(64))
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE fk VARCHAR(64);
  DECLARE cur CURSOR FOR
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND REFERENCED_TABLE_NAME IS NOT NULL;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN cur;
  REPEAT
    FETCH cur INTO fk;
    IF NOT done THEN
      SET @s = CONCAT('ALTER TABLE ', tbl, ' DROP FOREIGN KEY ', fk);
      PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
  UNTIL done END REPEAT;
  CLOSE cur;
END$$
DELIMITER ;


-- 删除租户/用户时，无 ON DELETE 动作的外键会阻塞删除（SQLSTATE 23503）。
-- 原则：
-- 1) 引用 users 且列可空的（教师/评分人/创建人等业务引用）→ ON DELETE SET NULL，保留业务数据
-- 2) 引用 users 且列 NOT NULL 的（学生所属的评价/作业提交记录）→ ON DELETE CASCADE，随用户删除
-- 3) 引用 tenants 的租户级业务表 → ON DELETE CASCADE，随租户删除清理全部数据

-- users 引用（SET NULL，可空列）
CALL drop_fk_if_exists('schedule_entries', 'teacher_id', 'users');
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('teaching_plan_entries', 'teacher_id', 'users');
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('course_evaluation_results', 'graded_by', 'users');
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('course_evaluation_results', 'evaluator_id', 'users');
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('course_homework_submissions', 'graded_by', 'users');
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('course_homeworks', 'creator_id', 'users');
ALTER TABLE course_homeworks ADD CONSTRAINT course_homeworks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('node_evaluation_results', 'graded_by', 'users');
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('node_evaluation_results', 'evaluator_id', 'users');
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('node_homework_submissions', 'graded_by', 'users');
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('node_homeworks', 'creator_id', 'users');
ALTER TABLE node_homeworks ADD CONSTRAINT node_homeworks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;

-- users 引用（CASCADE，NOT NULL 列）
CALL drop_fk_if_exists('course_evaluation_results', 'evaluatee_id', 'users');
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES users(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('course_homework_submissions', 'student_id', 'users');
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('node_evaluation_results', 'evaluatee_id', 'users');
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES users(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('node_homework_submissions', 'student_id', 'users');
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

-- tenants 引用（CASCADE）
CALL drop_fk_if_exists('affairs_batches', 'tenant_id', 'tenants');
ALTER TABLE affairs_batches ADD CONSTRAINT affairs_batches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('course_evaluation_results', 'tenant_id', 'tenants');
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('course_homework_submissions', 'tenant_id', 'tenants');
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('course_homeworks', 'tenant_id', 'tenants');
ALTER TABLE course_homeworks ADD CONSTRAINT course_homeworks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('node_evaluation_results', 'tenant_id', 'tenants');
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('node_homework_submissions', 'tenant_id', 'tenants');
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('period_slots', 'tenant_id', 'tenants');
ALTER TABLE period_slots ADD CONSTRAINT period_slots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('schedule_entries', 'tenant_id', 'tenants');
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('teaching_plans', 'tenant_id', 'tenants');
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('terms', 'tenant_id', 'tenants');
ALTER TABLE terms ADD CONSTRAINT terms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('training_programs', 'tenant_id', 'tenants');
ALTER TABLE training_programs ADD CONSTRAINT training_programs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('venues', 'tenant_id', 'tenants');
ALTER TABLE venues ADD CONSTRAINT venues_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
