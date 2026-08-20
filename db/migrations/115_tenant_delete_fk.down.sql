-- 还原：恢复无 ON DELETE 动作的外键定义
SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE venues DROP FOREIGN KEY venues_tenant_id_fkey;
ALTER TABLE venues ADD CONSTRAINT venues_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE training_programs DROP FOREIGN KEY training_programs_tenant_id_fkey;
ALTER TABLE training_programs ADD CONSTRAINT training_programs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE terms DROP FOREIGN KEY terms_tenant_id_fkey;
ALTER TABLE terms ADD CONSTRAINT terms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE teaching_plans DROP FOREIGN KEY teaching_plans_tenant_id_fkey;
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE schedule_entries DROP FOREIGN KEY schedule_entries_tenant_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE period_slots DROP FOREIGN KEY period_slots_tenant_id_fkey;
ALTER TABLE period_slots ADD CONSTRAINT period_slots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE node_homework_submissions DROP FOREIGN KEY node_homework_submissions_tenant_id_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE node_evaluation_results DROP FOREIGN KEY node_evaluation_results_tenant_id_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE course_homeworks DROP FOREIGN KEY course_homeworks_tenant_id_fkey;
ALTER TABLE course_homeworks ADD CONSTRAINT course_homeworks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE course_homework_submissions DROP FOREIGN KEY course_homework_submissions_tenant_id_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE course_evaluation_results DROP FOREIGN KEY course_evaluation_results_tenant_id_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE affairs_batches DROP FOREIGN KEY affairs_batches_tenant_id_fkey;
ALTER TABLE affairs_batches ADD CONSTRAINT affairs_batches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- users 引用（CASCADE，NOT NULL 列）
ALTER TABLE node_homework_submissions DROP FOREIGN KEY node_homework_submissions_student_id_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id);

ALTER TABLE node_evaluation_results DROP FOREIGN KEY node_evaluation_results_evaluatee_id_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES users(id);

ALTER TABLE course_homework_submissions DROP FOREIGN KEY course_homework_submissions_student_id_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id);

ALTER TABLE course_evaluation_results DROP FOREIGN KEY course_evaluation_results_evaluatee_id_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES users(id);

-- users 引用（SET NULL，可空列）
ALTER TABLE node_homeworks DROP FOREIGN KEY node_homeworks_creator_id_fkey;
ALTER TABLE node_homeworks ADD CONSTRAINT node_homeworks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id);

ALTER TABLE node_homework_submissions DROP FOREIGN KEY node_homework_submissions_graded_by_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id);

ALTER TABLE node_evaluation_results DROP FOREIGN KEY node_evaluation_results_evaluator_id_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES users(id);

ALTER TABLE node_evaluation_results DROP FOREIGN KEY node_evaluation_results_graded_by_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id);

ALTER TABLE course_homeworks DROP FOREIGN KEY course_homeworks_creator_id_fkey;
ALTER TABLE course_homeworks ADD CONSTRAINT course_homeworks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id);

ALTER TABLE course_homework_submissions DROP FOREIGN KEY course_homework_submissions_graded_by_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id);

ALTER TABLE course_evaluation_results DROP FOREIGN KEY course_evaluation_results_evaluator_id_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES users(id);

ALTER TABLE course_evaluation_results DROP FOREIGN KEY course_evaluation_results_graded_by_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id);

ALTER TABLE teaching_plan_entries DROP FOREIGN KEY teaching_plan_entries_teacher_id_fkey;
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id);

ALTER TABLE schedule_entries DROP FOREIGN KEY schedule_entries_teacher_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id);

SET FOREIGN_KEY_CHECKS = 1;