-- 回退：恢复类别列，从属性标签中提取原类别（无法精确还原自由标签，取首个命中）。
ALTER TABLE ability_points ADD COLUMN category VARCHAR(16);

UPDATE ability_points SET category = 'knowledge' WHERE JSON_CONTAINS(attributes, '知识', '$');
UPDATE ability_points SET category = 'skill' WHERE JSON_CONTAINS(attributes, '技能', '$') AND category IS NULL;
UPDATE ability_points SET category = 'quality' WHERE (JSON_CONTAINS(attributes, '素质', '$') OR JSON_CONTAINS(attributes, '素养', '$')) AND category IS NULL;
UPDATE ability_points SET category = 'skill' WHERE category IS NULL;

ALTER TABLE ability_points MODIFY COLUMN category VARCHAR(16) NOT NULL;
CREATE INDEX idx_ability_points_category ON ability_points (category);
