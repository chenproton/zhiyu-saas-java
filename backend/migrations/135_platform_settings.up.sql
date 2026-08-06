-- 平台级配置（键值），当前用于主题色配置
CREATE TABLE IF NOT EXISTS platform_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 默认主题色与 edu 前端 globals.css 的 --brand 保持一致
INSERT INTO platform_settings (key, value) VALUES ('theme_primary', '#4862e4')
    ON CONFLICT (key) DO NOTHING;
