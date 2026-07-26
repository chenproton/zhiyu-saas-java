-- Merge 'resource' ref_type into 'normal' for system course nodes.
-- After this migration, only 'normal' (manual edit) and 'original' (granular lesson) remain.

UPDATE system_course_nodes
SET ref_type = 'normal'
WHERE ref_type = 'resource';
