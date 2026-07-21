CREATE TABLE IF NOT EXISTS position_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    career_position_id UUID NOT NULL REFERENCES career_positions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, career_position_id)
);

CREATE INDEX IF NOT EXISTS idx_position_favorites_position_id ON position_favorites(career_position_id);
CREATE INDEX IF NOT EXISTS idx_position_favorites_user_id ON position_favorites(user_id);
