DROP INDEX IF EXISTS idx_node_hw_sub_student;
DROP INDEX IF EXISTS idx_node_hw_sub_homework;
DROP INDEX IF EXISTS idx_node_hw_sub_node;
DROP INDEX IF EXISTS idx_node_hw_sub_tenant;
DROP TABLE IF EXISTS node_homework_submissions;

ALTER TABLE node_homeworks
    DROP COLUMN IF EXISTS creator_id,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS created_at,
    DROP COLUMN IF EXISTS updated_at;
