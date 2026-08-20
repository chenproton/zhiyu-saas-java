-- 学生荣誉记录（个人中心-我的荣誉奖励配置，画像页展示）
CREATE TABLE student_honors (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(128) NOT NULL,
    issuer varchar(128) NOT NULL DEFAULT '',
    honor_date varchar(32) NOT NULL DEFAULT '',
    file_name varchar(256) NOT NULL DEFAULT '',
    file_url varchar(512) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_student_honors_user ON student_honors (user_id);
CREATE INDEX idx_student_honors_tenant ON student_honors (tenant_id);
