-- 知识点/能力点编码回填：为存量无编码行生成 KP-/NL- 编码。
-- 编码基于 id 的 md5 前 8 位，随 id 唯一且稳定。
UPDATE knowledge_points
SET code = CONCAT('KP-', UPPER(SUBSTRING(MD5(CAST(id AS CHAR)), 1, 8)))
WHERE code IS NULL OR code = '';

UPDATE ability_points
SET code = CONCAT('NL-', UPPER(SUBSTRING(MD5(CAST(id AS CHAR)), 1, 8)))
WHERE code IS NULL OR code = '';
