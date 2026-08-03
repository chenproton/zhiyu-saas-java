-- 还原：恢复无 ON DELETE 动作的外键定义
ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_tenant_id_fkey;
ALTER TABLE venues ADD CONSTRAINT venues_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE training_programs DROP CONSTRAINT IF EXISTS training_programs_tenant_id_fkey;
ALTER TABLE training_programs ADD CONSTRAINT training_programs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE terms DROP CONSTRAINT IF EXISTS terms_tenant_id_fkey;
ALTER TABLE terms ADD CONSTRAINT terms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE teaching_plans DROP CONSTRAINT IF EXISTS teaching_plans_tenant_id_fkey;
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_tenant_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE period_slots DROP CONSTRAINT IF EXISTS period_slots_tenant_id_fkey;
ALTER TABLE period_slots ADD CONSTRAINT period_slots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE node_homework_submissions DROP CONSTRAINT IF EXISTS node_homework_submissions_tenant_id_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE node_evaluation_results DROP CONSTRAINT IF EXISTS node_evaluation_results_tenant_id_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE course_homeworks DROP CONSTRAINT IF EXISTS course_homeworks_tenant_id_fkey;
ALTER TABLE course_homeworks ADD CONSTRAINT course_homeworks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE course_homework_submissions DROP CONSTRAINT IF EXISTS course_homework_submissions_tenant_id_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE course_evaluation_results DROP CONSTRAINT IF EXISTS course_evaluation_results_tenant_id_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE affairs_batches DROP CONSTRAINT IF EXISTS affairs_batches_tenant_id_fkey;
ALTER TABLE affairs_batches ADD CONSTRAINT affairs_batches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- users 引用（CASCADE，NOT NULL 列）
ALTER TABLE node_homework_submissions DROP CONSTRAINT IF EXISTS node_homework_submissions_student_id_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id);

ALTER TABLE node_evaluation_results DROP CONSTRAINT IF EXISTS node_evaluation_results_evaluatee_id_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES users(id);

ALTER TABLE course_homework_submissions DROP CONSTRAINT IF EXISTS course_homework_submissions_student_id_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id);

ALTER TABLE course_evaluation_results DROP CONSTRAINT IF EXISTS course_evaluation_results_evaluatee_id_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES users(id);

-- users 引用（SET NULL，可空列）
ALTER TABLE node_homeworks DROP CONSTRAINT IF EXISTS node_homeworks_creator_id_fkey;
ALTER TABLE node_homeworks ADD CONSTRAINT node_homeworks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id);

ALTER TABLE node_homework_submissions DROP CONSTRAINT IF EXISTS node_homework_submissions_graded_by_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id);

ALTER TABLE node_evaluation_results DROP CONSTRAINT IF EXISTS node_evaluation_results_evaluator_id_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES users(id);

ALTER TABLE node_evaluation_results DROP CONSTRAINT IF EXISTS node_evaluation_results_graded_by_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id);

ALTER TABLE course_homeworks DROP CONSTRAINT IF EXISTS course_homeworks_creator_id_fkey;
ALTER TABLE course_homeworks ADD CONSTRAINT course_homeworks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id);

ALTER TABLE course_homework_submissions DROP CONSTRAINT IF EXISTS course_homework_submissions_graded_by_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id);

ALTER TABLE course_evaluation_results DROP CONSTRAINT IF EXISTS course_evaluation_results_evaluator_id_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES users(id);

ALTER TABLE course_evaluation_results DROP CONSTRAINT IF EXISTS course_evaluation_results_graded_by_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id);

ALTER TABLE teaching_plan_entries DROP CONSTRAINT IF EXISTS teaching_plan_entries_teacher_id_fkey;
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id);

ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_teacher_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id);
