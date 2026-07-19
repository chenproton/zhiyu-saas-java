ALTER TABLE scenario_tasks DROP COLUMN IF EXISTS eval_data;
ALTER TABLE scenario_tasks DROP COLUMN IF EXISTS resource_ids;
ALTER TABLE scenario_tasks DROP COLUMN IF EXISTS ability_point_ids;
ALTER TABLE scenario_tasks DROP COLUMN IF EXISTS knowledge_point_ids;

ALTER TABLE knowledge_points DROP COLUMN IF EXISTS category;

ALTER TABLE ability_points DROP COLUMN IF EXISTS domain;
ALTER TABLE ability_points DROP COLUMN IF EXISTS code;

ALTER TABLE task_resources DROP COLUMN IF EXISTS knowledge_point_ids;
ALTER TABLE task_resources DROP COLUMN IF EXISTS size;
