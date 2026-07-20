-- 清理现有重复数据后，为业务表补上租户级 UNIQUE 约束。
-- 重复行保留 ctid 最小的一条，其余删除。

-- org_types
DELETE FROM org_types o1 USING org_types o2
WHERE o1.tenant_id = o2.tenant_id AND o1.name = o2.name AND o1.ctid > o2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_types_tenant_name ON org_types(tenant_id, name);

-- majors
DELETE FROM majors m1 USING majors m2
WHERE m1.tenant_id = m2.tenant_id AND m1.code = m2.code AND m1.ctid > m2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_majors_tenant_code ON majors(tenant_id, code);

-- industries
DELETE FROM industries i1 USING industries i2
WHERE i1.tenant_id = i2.tenant_id AND i1.code = i2.code AND i1.ctid > i2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_industries_tenant_code ON industries(tenant_id, code);

-- staff_titles
DELETE FROM staff_titles s1 USING staff_titles s2
WHERE s1.tenant_id = s2.tenant_id AND s1.code = s2.code AND s1.ctid > s2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_titles_tenant_code ON staff_titles(tenant_id, code);

-- courses
DELETE FROM courses c1 USING courses c2
WHERE c1.tenant_id = c2.tenant_id AND c1.code = c2.code AND c1.ctid > c2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_courses_tenant_code ON courses(tenant_id, code);

-- scenarios
DELETE FROM scenarios s1 USING scenarios s2
WHERE s1.tenant_id = s2.tenant_id AND s1.code = s2.code AND s1.ctid > s2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_scenarios_tenant_code ON scenarios(tenant_id, code);

-- question_banks
DELETE FROM question_banks q1 USING question_banks q2
WHERE q1.tenant_id = q2.tenant_id AND q1.name = q2.name AND q1.ctid > q2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_question_banks_tenant_name ON question_banks(tenant_id, name);

-- exams
DELETE FROM exams e1 USING exams e2
WHERE e1.tenant_id = e2.tenant_id AND e1.name = e2.name AND e1.ctid > e2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_exams_tenant_name ON exams(tenant_id, name);

-- knowledge_points
DELETE FROM knowledge_points k1 USING knowledge_points k2
WHERE k1.tenant_id = k2.tenant_id AND k1.name = k2.name AND k1.ctid > k2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_points_tenant_name ON knowledge_points(tenant_id, name);

-- ability_points
DELETE FROM ability_points a1 USING ability_points a2
WHERE a1.tenant_id = a2.tenant_id AND a1.name = a2.name AND a1.ctid > a2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ability_points_tenant_name ON ability_points(tenant_id, name);

-- career_positions
DELETE FROM career_positions c1 USING career_positions c2
WHERE c1.tenant_id = c2.tenant_id AND c1.name = c2.name AND c1.ctid > c2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_career_positions_tenant_name ON career_positions(tenant_id, name);

-- workflows
DELETE FROM workflows w1 USING workflows w2
WHERE w1.tenant_id IS NOT DISTINCT FROM w2.tenant_id AND w1.name = w2.name AND w1.ctid > w2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflows_tenant_name ON workflows(tenant_id, name);

-- graduation_project_topics
DELETE FROM graduation_project_topics g1 USING graduation_project_topics g2
WHERE g1.tenant_id = g2.tenant_id AND g1.name = g2.name AND g1.ctid > g2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_graduation_topics_tenant_name ON graduation_project_topics(tenant_id, name);

-- learn_roads
DELETE FROM learn_roads l1 USING learn_roads l2
WHERE l1.tenant_id = l2.tenant_id AND l1.name = l2.name AND l1.ctid > l2.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_learn_roads_tenant_name ON learn_roads(tenant_id, name);
