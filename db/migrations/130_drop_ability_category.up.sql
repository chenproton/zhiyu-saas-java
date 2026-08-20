-- 能力点类别（category）并入属性标签：类别职责由 attributes 承担。
-- 1) 将存量 category 值映射为属性标签（知识/技能/素质），与已有标签去重；
-- 2) 删除类别列及其索引。
-- MySQL 版：PG array_append/'=' = ANY(数组) 改 JSON_ARRAY_APPEND + JSON_CONTAINS。
UPDATE ability_points
SET attributes = JSON_ARRAY_APPEND(attributes, '$', '知识')
WHERE category = 'knowledge' AND NOT JSON_CONTAINS(attributes, '"知识"', '$');

UPDATE ability_points
SET attributes = JSON_ARRAY_APPEND(attributes, '$', '技能')
WHERE category = 'skill' AND NOT JSON_CONTAINS(attributes, '"技能"', '$');

UPDATE ability_points
SET attributes = JSON_ARRAY_APPEND(attributes, '$', '素质')
WHERE category = 'quality' AND NOT JSON_CONTAINS(attributes, '"素质"', '$');

DROP INDEX idx_ability_points_category ON ability_points;
ALTER TABLE ability_points DROP COLUMN category;
