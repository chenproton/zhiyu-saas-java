-- 还原：恢复无 ON DELETE 动作的租户内部 FK 定义
SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE teaching_plans DROP FOREIGN KEY teaching_plans_term_id_fkey;
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id);

ALTER TABLE teaching_plans DROP FOREIGN KEY teaching_plans_program_id_fkey;
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_program_id_fkey FOREIGN KEY (program_id) REFERENCES training_programs(id);

ALTER TABLE teaching_plan_entry_classes DROP FOREIGN KEY teaching_plan_entry_classes_class_node_id_fkey;
ALTER TABLE teaching_plan_entry_classes ADD CONSTRAINT teaching_plan_entry_classes_class_node_id_fkey FOREIGN KEY (class_node_id) REFERENCES organizations(id);

ALTER TABLE schedule_entries DROP FOREIGN KEY schedule_entries_term_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id);

ALTER TABLE schedule_entries DROP FOREIGN KEY schedule_entries_class_node_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_class_node_id_fkey FOREIGN KEY (class_node_id) REFERENCES organizations(id);

ALTER TABLE organizations DROP FOREIGN KEY fk_organizations_type;
ALTER TABLE organizations ADD CONSTRAINT fk_organizations_type FOREIGN KEY (type_id) REFERENCES org_types(id);

ALTER TABLE node_homework_submissions DROP FOREIGN KEY node_homework_submissions_homework_id_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_homework_id_fkey FOREIGN KEY (homework_id) REFERENCES node_homeworks(id);

ALTER TABLE node_homework_submissions DROP FOREIGN KEY node_homework_submissions_node_id_fkey;
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id);

ALTER TABLE node_evaluation_results DROP FOREIGN KEY node_evaluation_results_node_id_fkey;
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id);

ALTER TABLE graduation_project_evaluations DROP FOREIGN KEY graduation_project_evaluations_topic_id_fkey;
ALTER TABLE graduation_project_evaluations ADD CONSTRAINT graduation_project_evaluations_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES graduation_project_topics(id);

ALTER TABLE graduation_project_archives DROP FOREIGN KEY graduation_project_archives_topic_id_fkey;
ALTER TABLE graduation_project_archives ADD CONSTRAINT graduation_project_archives_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES graduation_project_topics(id);

ALTER TABLE course_homeworks DROP FOREIGN KEY course_homeworks_course_id_fkey;
ALTER TABLE course_homeworks ADD CONSTRAINT course_homeworks_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE course_homework_submissions DROP FOREIGN KEY course_homework_submissions_homework_id_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_homework_id_fkey FOREIGN KEY (homework_id) REFERENCES course_homeworks(id);

ALTER TABLE course_homework_submissions DROP FOREIGN KEY course_homework_submissions_course_id_fkey;
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE course_evaluation_results DROP FOREIGN KEY course_evaluation_results_course_id_fkey;
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE cert_issuance_records DROP FOREIGN KEY cert_issuance_records_template_id_fkey;
ALTER TABLE cert_issuance_records ADD CONSTRAINT cert_issuance_records_template_id_fkey FOREIGN KEY (template_id) REFERENCES micro_cert_templates(id);

ALTER TABLE training_program_courses DROP FOREIGN KEY training_program_courses_position_id_fkey;
ALTER TABLE training_program_courses ADD CONSTRAINT training_program_courses_position_id_fkey FOREIGN KEY (position_id) REFERENCES career_positions(id);

ALTER TABLE training_program_courses DROP FOREIGN KEY training_program_courses_course_id_fkey;
ALTER TABLE training_program_courses ADD CONSTRAINT training_program_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE teaching_plan_entries DROP FOREIGN KEY teaching_plan_entries_scenario_id_fkey;
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id);

ALTER TABLE teaching_plan_entries DROP FOREIGN KEY teaching_plan_entries_course_id_fkey;
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE teaching_plan_entries DROP FOREIGN KEY teaching_plan_entries_class_node_id_fkey;
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_class_node_id_fkey FOREIGN KEY (class_node_id) REFERENCES organizations(id);

ALTER TABLE training_programs DROP FOREIGN KEY training_programs_major_id_fkey;
ALTER TABLE training_programs ADD CONSTRAINT training_programs_major_id_fkey FOREIGN KEY (major_id) REFERENCES majors(id);

ALTER TABLE teaching_plans DROP FOREIGN KEY teaching_plans_major_id_fkey;
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_major_id_fkey FOREIGN KEY (major_id) REFERENCES majors(id);

ALTER TABLE affairs_batches DROP FOREIGN KEY affairs_batches_org_node_id_fkey;
ALTER TABLE affairs_batches ADD CONSTRAINT affairs_batches_org_node_id_fkey FOREIGN KEY (org_node_id) REFERENCES organizations(id);

ALTER TABLE affairs_batches DROP FOREIGN KEY affairs_batches_major_id_fkey;
ALTER TABLE affairs_batches ADD CONSTRAINT affairs_batches_major_id_fkey FOREIGN KEY (major_id) REFERENCES majors(id);

ALTER TABLE schedule_entries DROP FOREIGN KEY schedule_entries_plan_entry_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_plan_entry_id_fkey FOREIGN KEY (plan_entry_id) REFERENCES teaching_plan_entries(id);

ALTER TABLE schedule_entries DROP FOREIGN KEY schedule_entries_venue_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id);

ALTER TABLE schedule_entries DROP FOREIGN KEY schedule_entries_scenario_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id);

ALTER TABLE schedule_entries DROP FOREIGN KEY schedule_entries_course_id_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

SET FOREIGN_KEY_CHECKS = 1;