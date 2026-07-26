-- 为岗位、题库、题目、试卷新增 code 字段，并将场景/课程的已有 code 统一为 XX-XXXXXXXX 规则。

-- 1. 新增 code 列
ALTER TABLE career_positions ADD COLUMN IF NOT EXISTS code VARCHAR(64);
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS code VARCHAR(64);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS code VARCHAR(64);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS code VARCHAR(64);

-- 2. 定义随机编码生成函数（仅用于本 migration 回填）
CREATE OR REPLACE FUNCTION _tmp_generate_entity_code(prefix TEXT, len INT DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
    alphabet TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    result TEXT := prefix || '-';
    i INT;
    idx INT;
BEGIN
    FOR i IN 1..len LOOP
        idx := floor(random() * length(alphabet))::INT + 1;
        result := result || substr(alphabet, idx, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. 回填已有数据（逐行生成不同随机串，避免简单 set 导致全表相同）
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT id FROM career_positions WHERE code IS NULL OR code = '' LOOP
        UPDATE career_positions SET code = _tmp_generate_entity_code('GW') WHERE id = rec.id;
    END LOOP;

    FOR rec IN SELECT id FROM question_banks WHERE code IS NULL OR code = '' LOOP
        UPDATE question_banks SET code = _tmp_generate_entity_code('TK') WHERE id = rec.id;
    END LOOP;

    FOR rec IN SELECT id FROM questions WHERE code IS NULL OR code = '' LOOP
        UPDATE questions SET code = _tmp_generate_entity_code('TM') WHERE id = rec.id;
    END LOOP;

    FOR rec IN SELECT id FROM exams WHERE code IS NULL OR code = '' LOOP
        UPDATE exams SET code = _tmp_generate_entity_code('SJ') WHERE id = rec.id;
    END LOOP;

    -- 场景/课程已有 code，统一替换为新规则
    FOR rec IN SELECT id FROM scenarios LOOP
        UPDATE scenarios SET code = _tmp_generate_entity_code('CJ') WHERE id = rec.id;
    END LOOP;

    FOR rec IN SELECT id FROM courses LOOP
        UPDATE courses SET code = CASE
            WHEN type = 'granular' THEN _tmp_generate_entity_code('KL')
            ELSE _tmp_generate_entity_code('XT')
        END WHERE id = rec.id;
    END LOOP;
END $$;

-- 4. 设置非空约束（ scenes/courses 原本已有 NOT NULL，保持不变；新增列设为 NOT NULL）
ALTER TABLE career_positions ALTER COLUMN code SET NOT NULL;
ALTER TABLE question_banks ALTER COLUMN code SET NOT NULL;
ALTER TABLE questions ALTER COLUMN code SET NOT NULL;
ALTER TABLE exams ALTER COLUMN code SET NOT NULL;

-- 5. 租户级唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS uq_career_positions_tenant_code ON career_positions(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_question_banks_tenant_code ON question_banks(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_tenant_code ON questions(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_exams_tenant_code ON exams(tenant_id, code);

-- scenarios/courses 的租户级 code 唯一索引已存在，无需重复创建

-- 6. 清理临时函数
DROP FUNCTION IF EXISTS _tmp_generate_entity_code(TEXT, INT);
