-- 088_align_course_node_with_task.up.sql

ALTER TABLE system_course_nodes
    ADD COLUMN IF NOT EXISTS code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS detailed_description TEXT,
    ADD COLUMN IF NOT EXISTS description_pdf VARCHAR(512),
    ADD COLUMN IF NOT EXISTS background TEXT,
    ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,1),
    ADD COLUMN IF NOT EXISTS eval_data JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_system_course_nodes_code ON system_course_nodes(code);
