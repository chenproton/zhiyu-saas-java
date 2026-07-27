-- 088_align_course_node_with_task.down.sql
DROP INDEX IF EXISTS idx_system_course_nodes_code;
ALTER TABLE system_course_nodes
    DROP COLUMN IF EXISTS eval_data,
    DROP COLUMN IF EXISTS estimated_hours,
    DROP COLUMN IF EXISTS background,
    DROP COLUMN IF EXISTS description_pdf,
    DROP COLUMN IF EXISTS detailed_description,
    DROP COLUMN IF EXISTS code;
