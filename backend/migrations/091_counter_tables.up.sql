CREATE TABLE IF NOT EXISTS view_counters (
    target_type VARCHAR(64) NOT NULL,
    target_id UUID NOT NULL,
    cnt BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS favorite_counters (
    target_type VARCHAR(64) NOT NULL DEFAULT 'career_position',
    target_id UUID NOT NULL,
    cnt BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (target_type, target_id)
);
