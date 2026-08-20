-- 版本号格式统一：v1.0 / V1.0 / 1.0 / v1 / vV1.0 等历史脏值归一为「V1.0 大写前缀」。
-- 规则：
--   1. 去首尾空白，剥离连续的 v/V 前缀（防止 vV1.0 之类双重前缀）
--   2. 空值（NULL/''）→ V1.0（与创建默认值对齐）
--   3. 纯数字（如 v1）→ 补 .0 成 V1.0
--   4. 自定义版本号（如 v2.3.4）仅规范化前缀大小写，数字部分不动
-- MySQL 实现（原 PG 自定义函数 normalize_resource_version 以表达式内联）：
--   规范化 = CASE WHEN 空 → '1.0'
--                WHEN 剥离 v/V 前缀后为空 → '1.0'
--                WHEN 剥离后为纯数字 → 数字 + '.0'
--                ELSE 剥离后原样
--            END，最终 CONCAT('V', 规范化)
UPDATE career_positions SET version = CONCAT('V', CASE
    WHEN NULLIF(TRIM(version), '') IS NULL THEN '1.0'
    WHEN REGEXP_REPLACE(TRIM(version), '^[vV]+', '') = '' THEN '1.0'
    WHEN REGEXP_REPLACE(TRIM(version), '^[vV]+', '') REGEXP '^[0-9]+$' THEN CONCAT(REGEXP_REPLACE(TRIM(version), '^[vV]+', ''), '.0')
    ELSE REGEXP_REPLACE(TRIM(version), '^[vV]+', '')
END);
UPDATE scenarios SET version = CONCAT('V', CASE
    WHEN NULLIF(TRIM(version), '') IS NULL THEN '1.0'
    WHEN REGEXP_REPLACE(TRIM(version), '^[vV]+', '') = '' THEN '1.0'
    WHEN REGEXP_REPLACE(TRIM(version), '^[vV]+', '') REGEXP '^[0-9]+$' THEN CONCAT(REGEXP_REPLACE(TRIM(version), '^[vV]+', ''), '.0')
    ELSE REGEXP_REPLACE(TRIM(version), '^[vV]+', '')
END);
UPDATE courses SET version = CONCAT('V', CASE
    WHEN NULLIF(TRIM(version), '') IS NULL THEN '1.0'
    WHEN REGEXP_REPLACE(TRIM(version), '^[vV]+', '') = '' THEN '1.0'
    WHEN REGEXP_REPLACE(TRIM(version), '^[vV]+', '') REGEXP '^[0-9]+$' THEN CONCAT(REGEXP_REPLACE(TRIM(version), '^[vV]+', ''), '.0')
    ELSE REGEXP_REPLACE(TRIM(version), '^[vV]+', '')
END);
UPDATE exams SET version = CONCAT('V', CASE
    WHEN NULLIF(TRIM(version), '') IS NULL THEN '1.0'
    WHEN REGEXP_REPLACE(TRIM(version), '^[vV]+', '') = '' THEN '1.0'
    WHEN REGEXP_REPLACE(TRIM(version), '^[vV]+', '') REGEXP '^[0-9]+$' THEN CONCAT(REGEXP_REPLACE(TRIM(version), '^[vV]+', ''), '.0')
    ELSE REGEXP_REPLACE(TRIM(version), '^[vV]+', '')
END);
UPDATE question_banks SET version = CONCAT('V', CASE
    WHEN NULLIF(TRIM(version), '') IS NULL THEN '1.0'
    WHEN REGEXP_REPLACE(TRIM(version), '^[vV]+', '') = '' THEN '1.0'
    WHEN REGEXP_REPLACE(TRIM(version), '^[vV]+', '') REGEXP '^[0-9]+$' THEN CONCAT(REGEXP_REPLACE(TRIM(version), '^[vV]+', ''), '.0')
    ELSE REGEXP_REPLACE(TRIM(version), '^[vV]+', '')
END);
