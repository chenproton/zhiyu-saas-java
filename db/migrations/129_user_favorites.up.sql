-- 通用收藏表：场景/课程/题库/试卷收藏（岗位收藏沿用 position_favorites）
CREATE TABLE user_favorites (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    user_id CHAR(36) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE user_favorites
    ADD CONSTRAINT user_favorites_pkey PRIMARY KEY (id);

ALTER TABLE user_favorites
    ADD CONSTRAINT user_favorites_user_type_target_key UNIQUE (user_id, target_type, target_id);

CREATE INDEX idx_user_favorites_user_id ON user_favorites (user_id);
CREATE INDEX idx_user_favorites_target ON user_favorites (target_type, target_id);
