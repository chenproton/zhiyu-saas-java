-- 企业端资源共建来源标记：career_positions / scenarios 增加 source_type 与
-- source_enterprise_id（来源企业主体，企业删除时置空保留资源）。学校端数据默认 'school'，行为不变。
ALTER TABLE career_positions ADD COLUMN source_type varchar(16) NOT NULL DEFAULT 'school';
ALTER TABLE career_positions ADD COLUMN source_enterprise_id CHAR(36) REFERENCES partner_enterprises(id) ON DELETE SET NULL;
ALTER TABLE career_positions ADD CONSTRAINT career_positions_source_type_check CHECK (source_type IN ('school', 'enterprise'));
CREATE INDEX idx_career_positions_source_enterprise ON career_positions (source_enterprise_id);

ALTER TABLE scenarios ADD COLUMN source_type varchar(16) NOT NULL DEFAULT 'school';
ALTER TABLE scenarios ADD COLUMN source_enterprise_id CHAR(36) REFERENCES partner_enterprises(id) ON DELETE SET NULL;
ALTER TABLE scenarios ADD CONSTRAINT scenarios_source_type_check CHECK (source_type IN ('school', 'enterprise'));
CREATE INDEX idx_scenarios_source_enterprise ON scenarios (source_enterprise_id);
