-- 企业注册默认开启"愿意对外展示"开关（服务层已置 true，DB 默认值对齐）
ALTER TABLE partner_enterprises ALTER COLUMN enable_public SET DEFAULT 1;
