-- Add major_id UUID FK to random_draw_questions and migrate from name-based major
BEGIN;

ALTER TABLE random_draw_questions ADD COLUMN IF NOT EXISTS major_id UUID;

UPDATE random_draw_questions rdq
SET major_id = m.id
FROM majors m
WHERE rdq.major IS NOT NULL
  AND rdq.major_id IS NULL
  AND m.name = rdq.major;

ALTER TABLE random_draw_questions DROP COLUMN IF EXISTS major;

ALTER TABLE random_draw_questions
  ADD CONSTRAINT fk_rdq_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS idx_rdq_major;
CREATE INDEX IF NOT EXISTS idx_rdq_major_id ON random_draw_questions(major_id);

COMMIT;
