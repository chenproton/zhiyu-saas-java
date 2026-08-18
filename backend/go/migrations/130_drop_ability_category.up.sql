-- 能力点类别（category）并入属性标签：类别职责由 attributes 承担。
-- 1) 将存量 category 值映射为属性标签（知识/技能/素质），与已有标签去重；
-- 2) 删除类别列及其索引。
UPDATE ability_points
SET attributes = array_append(attributes, '知识')
WHERE category = 'knowledge' AND NOT ('知识' = ANY(attributes));

UPDATE ability_points
SET attributes = array_append(attributes, '技能')
WHERE category = 'skill' AND NOT ('技能' = ANY(attributes));

UPDATE ability_points
SET attributes = array_append(attributes, '素质')
WHERE category = 'quality' AND NOT ('素质' = ANY(attributes));

DROP INDEX IF EXISTS idx_ability_points_category;
ALTER TABLE ability_points DROP COLUMN category;
