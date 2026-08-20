SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE subscription_packages DROP COLUMN ai_token_quota;

SET FOREIGN_KEY_CHECKS = 1;