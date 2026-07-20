-- 为业务表补上租户级 UNIQUE 约束，确保同租户内唯一、租户间可重复。
-- 跳过 organizations（唯一性依赖 parent_id，更复杂）。
-- 使用 CREATE UNIQUE INDEX IF NOT EXISTS 避免重复添加。

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_types_tenant_name          ON org_types(tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_majors_tenant_code             ON majors(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_industries_tenant_code         ON industries(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_titles_tenant_code       ON staff_titles(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_courses_tenant_code            ON courses(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scenarios_tenant_code          ON scenarios(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_question_banks_tenant_name     ON question_banks(tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_exams_tenant_name              ON exams(tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_points_tenant_name   ON knowledge_points(tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ability_points_tenant_name     ON ability_points(tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_career_positions_tenant_name   ON career_positions(tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflows_tenant_name          ON workflows(tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_graduation_topics_tenant_name  ON graduation_project_topics(tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_learn_roads_tenant_name        ON learn_roads(tenant_id, name);
