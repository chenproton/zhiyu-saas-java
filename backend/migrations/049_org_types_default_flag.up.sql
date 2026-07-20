ALTER TABLE org_types ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE org_types
SET is_default = TRUE
WHERE description IN ('学校根节点', '二级学院/系', '专业节点', '班级节点', '行政职能部门');
