INSERT INTO platform_configs (key, value, updated_at)
VALUES ('credit_hours_ratio', '16', NOW())
ON CONFLICT (key) DO NOTHING;
