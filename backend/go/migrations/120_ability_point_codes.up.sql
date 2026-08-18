-- 能力点编码回填：为存量能力点生成 NL-XXXXXXXX 编码。
-- 编码基于 id 的 md5 前 8 位，随 id 唯一且稳定。
UPDATE ability_points
SET code = 'NL-' || upper(substr(md5(id::text), 1, 8))
WHERE code IS NULL OR code = '';
