-- 品牌表：添加平台实体 FK 关联列
ALTER TABLE alliance_brands ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE alliance_brands ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES alliance_enterprises(id) ON DELETE SET NULL;
ALTER TABLE alliance_brands ADD COLUMN IF NOT EXISTS position_id UUID;
ALTER TABLE alliance_brands ADD COLUMN IF NOT EXISTS major_id UUID;
ALTER TABLE alliance_brands ADD COLUMN IF NOT EXISTS teacher_id UUID;
ALTER TABLE alliance_brands ADD COLUMN IF NOT EXISTS expert_id UUID REFERENCES alliance_experts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_alliance_brands_student ON alliance_brands(student_id);
CREATE INDEX IF NOT EXISTS idx_alliance_brands_enterprise ON alliance_brands(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_alliance_brands_position ON alliance_brands(position_id);
CREATE INDEX IF NOT EXISTS idx_alliance_brands_major ON alliance_brands(major_id);
CREATE INDEX IF NOT EXISTS idx_alliance_brands_teacher ON alliance_brands(teacher_id);
CREATE INDEX IF NOT EXISTS idx_alliance_brands_expert ON alliance_brands(expert_id);

-- 项目表：添加协议关联
ALTER TABLE alliance_projects ADD COLUMN IF NOT EXISTS agreement_ids JSONB DEFAULT '[]';

-- 成果表：丰富字段
ALTER TABLE alliance_achievements ADD COLUMN IF NOT EXISTS citation_reason TEXT;
ALTER TABLE alliance_achievements ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
ALTER TABLE alliance_achievements ADD COLUMN IF NOT EXISTS owner_persons JSONB DEFAULT '[]';
ALTER TABLE alliance_achievements ADD COLUMN IF NOT EXISTS co_builders JSONB DEFAULT '[]';

-- 专家表：丰富字段
ALTER TABLE alliance_experts ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE alliance_experts ADD COLUMN IF NOT EXISTS partner_source VARCHAR(32) DEFAULT 'cooperation';
ALTER TABLE alliance_experts ADD COLUMN IF NOT EXISTS position_direction VARCHAR(255);
