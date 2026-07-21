-- 057_add_position_view_count
-- 为 career_positions 增加静态浏览次数字段，每次访问详情页递增

ALTER TABLE career_positions ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_career_positions_view_count ON career_positions(view_count DESC);
