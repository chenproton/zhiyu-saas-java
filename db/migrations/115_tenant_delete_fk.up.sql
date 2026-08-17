-- 删除租户/用户时，无 ON DELETE 动作的外键会阻塞删除（SQLSTATE 23503）。
-- 原则：
-- 1) 引用 users 且列可空的（教师/评分人/创建人等业务引用）→ ON DELETE SET NULL，保留业务数据
-- 2) 引用 users 且列 NOT NULL 的（学生所属的评价/作业提交记录）→ ON DELETE CASCADE，随用户删除
-- 3) 引用 tenants 的租户级业务表 → ON DELETE CASCADE，随租户删除清理全部数据

-- users 引用（SET NULL，可空列）
ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_teacher_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE teaching_plan_entries DROP CONSTRAINT IF EXISTS teaching_plan_entries_teacher_id_fkey;
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE course_evaluation_results DROP CONSTRAINT IF EXISTS course_evaluation_results_graded_by_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE course_evaluation_results DROP CONSTRAINT IF EXISTS course_evaluation_results_evaluator_id_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE course_homework_submissions DROP CONSTRAINT IF EXISTS course_homework_submissions_graded_by_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE course_homeworks DROP CONSTRAINT IF EXISTS course_homeworks_creator_id_fkey;
ALTER TABLE course_homeworks ADD CONSTRAINT course_homeworks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE node_evaluation_results DROP CONSTRAINT IF EXISTS node_evaluation_results_graded_by_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE node_evaluation_results DROP CONSTRAINT IF EXISTS node_evaluation_results_evaluator_id_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE node_homework_submissions DROP CONSTRAINT IF EXISTS node_homework_submissions_graded_by_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE node_homeworks DROP CONSTRAINT IF EXISTS node_homeworks_creator_id_fkey;
ALTER TABLE node_homeworks ADD CONSTRAINT node_homeworks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;

-- users 引用（CASCADE，NOT NULL 列）
ALTER TABLE course_evaluation_results DROP CONSTRAINT IF EXISTS course_evaluation_results_evaluatee_id_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE course_homework_submissions DROP CONSTRAINT IF EXISTS course_homework_submissions_student_id_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE node_evaluation_results DROP CONSTRAINT IF EXISTS node_evaluation_results_evaluatee_id_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE node_homework_submissions DROP CONSTRAINT IF EXISTS node_homework_submissions_student_id_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

-- tenants 引用（CASCADE）
ALTER TABLE affairs_batches DROP CONSTRAINT IF EXISTS affairs_batches_tenant_id_fkey;
ALTER TABLE affairs_batches ADD CONSTRAINT affairs_batches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE course_evaluation_results DROP CONSTRAINT IF EXISTS course_evaluation_results_tenant_id_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE course_homework_submissions DROP CONSTRAINT IF EXISTS course_homework_submissions_tenant_id_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE course_homeworks DROP CONSTRAINT IF EXISTS course_homeworks_tenant_id_fkey;
ALTER TABLE course_homeworks ADD CONSTRAINT course_homeworks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE node_evaluation_results DROP CONSTRAINT IF EXISTS node_evaluation_results_tenant_id_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE node_homework_submissions DROP CONSTRAINT IF EXISTS node_homework_submissions_tenant_id_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE period_slots DROP CONSTRAINT IF EXISTS period_slots_tenant_id_fkey;
ALTER TABLE period_slots ADD CONSTRAINT period_slots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_tenant_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE teaching_plans DROP CONSTRAINT IF EXISTS teaching_plans_tenant_id_fkey;
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE terms DROP CONSTRAINT IF EXISTS terms_tenant_id_fkey;
ALTER TABLE terms ADD CONSTRAINT terms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE training_programs DROP CONSTRAINT IF EXISTS training_programs_tenant_id_fkey;
ALTER TABLE training_programs ADD CONSTRAINT training_programs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_tenant_id_fkey;
ALTER TABLE venues ADD CONSTRAINT venues_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
