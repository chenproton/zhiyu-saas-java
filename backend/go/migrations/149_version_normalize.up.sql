-- 版本号格式统一：v1.0 / V1.0 / 1.0 / v1 / vV1.0 等历史脏值归一为「V1.0 大写前缀」。
-- 规则：
--   1. 去首尾空白，剥离连续的 v/V 前缀（防止 vV1.0 之类双重前缀）
--   2. 空值（NULL/''）→ V1.0（与创建默认值对齐）
--   3. 纯数字（如 v1）→ 补 .0 成 V1.0
--   4. 自定义版本号（如 v2.3.4）仅规范化前缀大小写，数字部分不动
CREATE OR REPLACE FUNCTION normalize_resource_version(v text) RETURNS text AS $$
DECLARE
  digits text;
BEGIN
  IF v IS NULL OR btrim(v) = '' THEN
    RETURN 'V1.0';
  END IF;
  digits := regexp_replace(btrim(v), '^[vV]+', '');
  IF digits = '' THEN
    digits := '1.0';
  END IF;
  IF digits ~ '^[0-9]+$' THEN
    digits := digits || '.0';
  END IF;
  RETURN 'V' || digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE career_positions SET version = normalize_resource_version(version);
UPDATE scenarios SET version = normalize_resource_version(version);
UPDATE courses SET version = normalize_resource_version(version);
UPDATE exams SET version = normalize_resource_version(version);
UPDATE question_banks SET version = normalize_resource_version(version);

DROP FUNCTION normalize_resource_version(text);
