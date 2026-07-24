-- Revert random_draw_questions major_id back to name-based major
BEGIN;

ALTER TABLE random_draw_questions DROP CONSTRAINT IF EXISTS fk_rdq_major;
DROP INDEX IF EXISTS idx_rdq_major_id;

ALTER TABLE random_draw_questions ADD COLUMN IF NOT EXISTS major VARCHAR(128);

UPDATE random_draw_questions rdq
SET major = m.name
FROM majors m
WHERE rdq.major_id IS NOT NULL
  AND m.id = rdq.major_id;

ALTER TABLE random_draw_questions DROP COLUMN IF EXISTS major_id;

CREATE INDEX IF NOT EXISTS idx_rdq_major ON random_draw_questions(major);

COMMIT;
