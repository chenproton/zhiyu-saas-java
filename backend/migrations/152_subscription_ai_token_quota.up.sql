-- 订阅增加 AI token 额度（超管在套餐配置中按人民币额度换算，2 元 / 1M token）
ALTER TABLE subscription_packages ADD COLUMN ai_token_quota bigint NOT NULL DEFAULT 0;
