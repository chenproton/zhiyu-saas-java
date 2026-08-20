-- 回退：恢复类别列，从属性标签中提取原类别（无法精确还原自由标签，取首个命中）。
ALTER TABLE ability_points ADD COLUMN category character varying(16);

UPDATE ability_points SET category = 'knowledge' WHERE '知识' = ANY(attributes);
UPDATE ability_points SET category = 'skill' WHERE '技能' = ANY(attributes) AND category IS NULL;
UPDATE ability_points SET category = 'quality' WHERE ('素质' = ANY(attributes) OR '素养' = ANY(attributes)) AND category IS NULL;
UPDATE ability_points SET category = 'skill' WHERE category IS NULL;

ALTER TABLE ability_points ALTER COLUMN category SET NOT NULL;
CREATE INDEX idx_ability_points_category ON public.ability_points USING btree (category);
