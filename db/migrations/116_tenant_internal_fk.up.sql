-- 租户级联删除时，租户内部表之间的 FK 若无 ON DELETE 动作，会因级联触发顺序不同报 23503。
-- 原则（同 115）：可空列 → ON DELETE SET NULL（保留数据）；NOT NULL 列 → ON DELETE CASCADE（随父记录删除）。

-- SET NULL（可空列）
CALL drop_fk_if_exists('schedule_entries', 'course_id', 'courses');
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('schedule_entries', 'scenario_id', 'scenarios');
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('schedule_entries', 'venue_id', 'venues');
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('schedule_entries', 'plan_entry_id', 'teaching_plan_entries');
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_plan_entry_id_fkey FOREIGN KEY (plan_entry_id) REFERENCES teaching_plan_entries(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('affairs_batches', 'major_id', 'majors');
ALTER TABLE affairs_batches ADD CONSTRAINT affairs_batches_major_id_fkey FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('affairs_batches', 'org_node_id', 'organizations');
ALTER TABLE affairs_batches ADD CONSTRAINT affairs_batches_org_node_id_fkey FOREIGN KEY (org_node_id) REFERENCES organizations(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('teaching_plans', 'major_id', 'majors');
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_major_id_fkey FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('training_programs', 'major_id', 'majors');
ALTER TABLE training_programs ADD CONSTRAINT training_programs_major_id_fkey FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('teaching_plan_entries', 'class_node_id', 'organizations');
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_class_node_id_fkey FOREIGN KEY (class_node_id) REFERENCES organizations(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('teaching_plan_entries', 'course_id', 'courses');
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('teaching_plan_entries', 'scenario_id', 'scenarios');
ALTER TABLE teaching_plan_entries ADD CONSTRAINT teaching_plan_entries_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('training_program_courses', 'course_id', 'courses');
ALTER TABLE training_program_courses ADD CONSTRAINT training_program_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('training_program_courses', 'position_id', 'career_positions');
ALTER TABLE training_program_courses ADD CONSTRAINT training_program_courses_position_id_fkey FOREIGN KEY (position_id) REFERENCES career_positions(id) ON DELETE SET NULL;

-- CASCADE（NOT NULL 列）
CALL drop_fk_if_exists('cert_issuance_records', 'template_id', 'micro_cert_templates');
ALTER TABLE cert_issuance_records ADD CONSTRAINT cert_issuance_records_template_id_fkey FOREIGN KEY (template_id) REFERENCES micro_cert_templates(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('course_evaluation_results', 'course_id', 'courses');
ALTER TABLE course_evaluation_results ADD CONSTRAINT course_evaluation_results_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('course_homework_submissions', 'course_id', 'courses');
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('course_homework_submissions', 'homework_id', 'course_homeworks');
ALTER TABLE course_homework_submissions ADD CONSTRAINT course_homework_submissions_homework_id_fkey FOREIGN KEY (homework_id) REFERENCES course_homeworks(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('course_homeworks', 'course_id', 'courses');
ALTER TABLE course_homeworks ADD CONSTRAINT course_homeworks_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('graduation_project_archives', 'topic_id', 'graduation_project_topics');
ALTER TABLE graduation_project_archives ADD CONSTRAINT graduation_project_archives_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES graduation_project_topics(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('graduation_project_evaluations', 'topic_id', 'graduation_project_topics');
ALTER TABLE graduation_project_evaluations ADD CONSTRAINT graduation_project_evaluations_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES graduation_project_topics(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('node_evaluation_results', 'node_id', 'system_course_nodes');
ALTER TABLE node_evaluation_results ADD CONSTRAINT node_evaluation_results_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('node_homework_submissions', 'node_id', 'system_course_nodes');
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('node_homework_submissions', 'homework_id', 'node_homeworks');
ALTER TABLE node_homework_submissions ADD CONSTRAINT node_homework_submissions_homework_id_fkey FOREIGN KEY (homework_id) REFERENCES node_homeworks(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('organizations', 'type_id', 'org_types');
ALTER TABLE organizations ADD CONSTRAINT fk_organizations_type FOREIGN KEY (type_id) REFERENCES org_types(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('schedule_entries', 'class_node_id', 'organizations');
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_class_node_id_fkey FOREIGN KEY (class_node_id) REFERENCES organizations(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('schedule_entries', 'term_id', 'terms');
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('teaching_plan_entry_classes', 'class_node_id', 'organizations');
ALTER TABLE teaching_plan_entry_classes ADD CONSTRAINT teaching_plan_entry_classes_class_node_id_fkey FOREIGN KEY (class_node_id) REFERENCES organizations(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('teaching_plans', 'program_id', 'training_programs');
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_program_id_fkey FOREIGN KEY (program_id) REFERENCES training_programs(id) ON DELETE CASCADE;

CALL drop_fk_if_exists('teaching_plans', 'term_id', 'terms');
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
