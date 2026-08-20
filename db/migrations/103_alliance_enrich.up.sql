-- 品牌表：添加平台实体 FK 关联列
ALTER TABLE alliance_brands ADD COLUMN student_id CHAR(36);
ALTER TABLE alliance_brands ADD COLUMN enterprise_id CHAR(36) REFERENCES alliance_enterprises(id) ON DELETE SET NULL;
ALTER TABLE alliance_brands ADD COLUMN position_id CHAR(36);
ALTER TABLE alliance_brands ADD COLUMN major_id CHAR(36);
ALTER TABLE alliance_brands ADD COLUMN teacher_id CHAR(36);
ALTER TABLE alliance_brands ADD COLUMN expert_id CHAR(36) REFERENCES alliance_experts(id) ON DELETE SET NULL;
CREATE INDEX idx_alliance_brands_student ON alliance_brands(student_id);
CREATE INDEX idx_alliance_brands_enterprise ON alliance_brands(enterprise_id);
CREATE INDEX idx_alliance_brands_position ON alliance_brands(position_id);
CREATE INDEX idx_alliance_brands_major ON alliance_brands(major_id);
CREATE INDEX idx_alliance_brands_teacher ON alliance_brands(teacher_id);
CREATE INDEX idx_alliance_brands_expert ON alliance_brands(expert_id);

-- 项目表：添加协议关联
ALTER TABLE alliance_projects ADD COLUMN agreement_ids JSON DEFAULT (JSON_ARRAY());

-- 成果表：丰富字段
ALTER TABLE alliance_achievements ADD COLUMN citation_reason TEXT;
ALTER TABLE alliance_achievements ADD COLUMN images JSON DEFAULT (JSON_ARRAY());
ALTER TABLE alliance_achievements ADD COLUMN owner_persons JSON DEFAULT (JSON_ARRAY());
ALTER TABLE alliance_achievements ADD COLUMN co_builders JSON DEFAULT (JSON_ARRAY());

-- 专家表：丰富字段
ALTER TABLE alliance_experts ADD COLUMN cover_image TEXT;
ALTER TABLE alliance_experts ADD COLUMN partner_source VARCHAR(32) DEFAULT 'cooperation';
ALTER TABLE alliance_experts ADD COLUMN position_direction VARCHAR(255);
