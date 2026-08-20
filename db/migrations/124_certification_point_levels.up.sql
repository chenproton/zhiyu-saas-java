-- 能力点五档分数线配置（每能力点独立，岗位+能力点维度唯一）
CREATE TABLE certification_point_levels (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    career_position_id CHAR(36) NOT NULL,
    ability_point_id CHAR(36) NOT NULL,
    level_mapping JSON NOT NULL DEFAULT (JSON_ARRAY()),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_cert_point_levels_uniq ON certification_point_levels (tenant_id, career_position_id, ability_point_id);
CREATE INDEX idx_cert_point_levels_position ON certification_point_levels (career_position_id);
