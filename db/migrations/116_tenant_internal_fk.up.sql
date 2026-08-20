-- 租户级联删除时，租户内部表之间的 FK 若无 ON DELETE 动作，会因级联触发顺序不同报 23503。
-- 原则（同 115）：可空列 → ON DELETE SET NULL（保留数据）；NOT NULL 列 → ON DELETE CASCADE（随父记录删除）。

-- SET NULL（可空列）
ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_course_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_scenario_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE SET NULL;

ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_venue_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL;

ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_plan_entry_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_plan_entry_id_fkey FOREIGN KEY (plan_entry_id) REFERENCES teaching_plan_entries(id) ON DELETE SET NULL;

ALTER TABLE affairs_batches DROP CONSTRAINT IF EXISTS affairs_batches_major_id_fkey;
ALTER TABLE affairs_batches ADD CONSTRAINT affairs_batches_major_id_fkey FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;

ALTER TABLE affairs_batches DROP CONSTRAINT IF EXISTS affairs_batches_org_node_id_fkey;
ALTER TABLE affairs_batches ADD CONSTRAINT affairs_batches_org_node_id_fkey FOREIGN KEY (org_node_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE teaching_plans DROP CONSTRAINT IF EXISTS teaching_plans_major_id_fkey;
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_major_id_fkey FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;

ALTER TABLE training_programs DROP CONSTRAINT IF EXISTS training_programs_major_id_fkey;
ALTER TABLE training_programs ADD CONSTRAINT training_programs_major_id_fkey FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;

ALTER TABLE teaching_plan_entries DROP CONSTRAINT IF EXISTS teaching_plan_entries_class_node_id_fkey;
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_class_node_id_fkey FOREIGN KEY (class_node_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE teaching_plan_entries DROP CONSTRAINT IF EXISTS teaching_plan_entries_course_id_fkey;
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

ALTER TABLE teaching_plan_entries DROP CONSTRAINT IF EXISTS teaching_plan_entries_scenario_id_fkey;
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE SET NULL;

ALTER TABLE training_program_courses DROP CONSTRAINT IF EXISTS training_program_courses_course_id_fkey;
ALTER TABLE training_program_courses ADD CONSTRAINT training_program_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

ALTER TABLE training_program_courses DROP CONSTRAINT IF EXISTS training_program_courses_position_id_fkey;
ALTER TABLE training_program_courses ADD CONSTRAINT training_program_courses_position_id_fkey FOREIGN KEY (position_id) REFERENCES career_positions(id) ON DELETE SET NULL;

-- CASCADE（NOT NULL 列）
ALTER TABLE cert_issuance_records DROP CONSTRAINT IF EXISTS cert_issuance_records_template_id_fkey;
ALTER TABLE cert_issuance_records ADD CONSTRAINT cert_issuance_records_template_id_fkey FOREIGN KEY (template_id) REFERENCES micro_cert_templates(id) ON DELETE CASCADE;

ALTER TABLE course_evaluation_results DROP CONSTRAINT IF EXISTS course_evaluation_results_course_id_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE course_homework_submissions DROP CONSTRAINT IF EXISTS course_homework_submissions_course_id_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE course_homework_submissions DROP CONSTRAINT IF EXISTS course_homework_submissions_homework_id_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_homework_id_fkey FOREIGN KEY (homework_id) REFERENCES course_homeworks(id) ON DELETE CASCADE;

ALTER TABLE course_homeworks DROP CONSTRAINT IF EXISTS course_homeworks_course_id_fkey;
ALTER TABLE course_homeworks ADD CONSTRAINT course_homeworks_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE graduation_project_archives DROP CONSTRAINT IF EXISTS graduation_project_archives_topic_id_fkey;
ALTER TABLE graduation_project_archives ADD CONSTRAINT graduation_project_archives_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES graduation_project_topics(id) ON DELETE CASCADE;

ALTER TABLE graduation_project_evaluations DROP CONSTRAINT IF EXISTS graduation_project_evaluations_topic_id_fkey;
ALTER TABLE graduation_project_evaluations ADD CONSTRAINT graduation_project_evaluations_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES graduation_project_topics(id) ON DELETE CASCADE;

ALTER TABLE node_evaluation_results DROP CONSTRAINT IF EXISTS node_evaluation_results_node_id_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id) ON DELETE CASCADE;

ALTER TABLE node_homework_submissions DROP CONSTRAINT IF EXISTS node_homework_submissions_node_id_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id) ON DELETE CASCADE;

ALTER TABLE node_homework_submissions DROP CONSTRAINT IF EXISTS node_homework_submissions_homework_id_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_homework_id_fkey FOREIGN KEY (homework_id) REFERENCES node_homeworks(id) ON DELETE CASCADE;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS fk_organizations_type;
ALTER TABLE organizations ADD CONSTRAINT fk_organizations_type FOREIGN KEY (type_id) REFERENCES org_types(id) ON DELETE CASCADE;

ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_class_node_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_class_node_id_fkey FOREIGN KEY (class_node_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_term_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;

ALTER TABLE teaching_plan_entry_classes DROP CONSTRAINT IF EXISTS teaching_plan_entry_classes_class_node_id_fkey;
ALTER TABLE teaching_plan_entry_classes ADD CONSTRAINT teaching_plan_entry_classes_class_node_id_fkey FOREIGN KEY (class_node_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE teaching_plans DROP CONSTRAINT IF EXISTS teaching_plans_program_id_fkey;
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_program_id_fkey FOREIGN KEY (program_id) REFERENCES training_programs(id) ON DELETE CASCADE;

ALTER TABLE teaching_plans DROP CONSTRAINT IF EXISTS teaching_plans_term_id_fkey;
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
