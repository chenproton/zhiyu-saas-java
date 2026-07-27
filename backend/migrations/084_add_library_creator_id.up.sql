ALTER TABLE ability_points ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE certificate_library ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE on_site_question_library ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ability_points_creator ON ability_points(creator_id);
CREATE INDEX IF NOT EXISTS idx_certificate_library_creator ON certificate_library(creator_id);
CREATE INDEX IF NOT EXISTS idx_on_site_question_library_creator ON on_site_question_library(creator_id);
