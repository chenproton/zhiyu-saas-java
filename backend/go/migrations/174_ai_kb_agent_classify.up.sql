-- 174: AI 知识库/智能体分类字段（大厅筛选：所属专业/所属院系/更新时间/知识库类型）
-- 字典来源：majors（系统专业字典）、organizations（系统院系字典，类型=二级学院）；均可空=不限
ALTER TABLE ai_knowledge_bases
    ADD COLUMN major_id UUID NULL REFERENCES majors(id) ON DELETE SET NULL,
    ADD COLUMN department_id UUID NULL REFERENCES organizations(id) ON DELETE SET NULL,
    ADD COLUMN kb_type VARCHAR(32) NULL; -- course_resource/research/teaching_case/qa
ALTER TABLE ai_agents
    ADD COLUMN major_id UUID NULL REFERENCES majors(id) ON DELETE SET NULL,
    ADD COLUMN department_id UUID NULL REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_ai_kbs_major ON ai_knowledge_bases(tenant_id, major_id) WHERE major_id IS NOT NULL;
CREATE INDEX idx_ai_kbs_dept ON ai_knowledge_bases(tenant_id, department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_ai_agents_major ON ai_agents(tenant_id, major_id) WHERE major_id IS NOT NULL;
CREATE INDEX idx_ai_agents_dept ON ai_agents(tenant_id, department_id) WHERE department_id IS NOT NULL;
