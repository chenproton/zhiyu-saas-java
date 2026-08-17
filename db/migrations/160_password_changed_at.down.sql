-- 回滚 160：删除 password_changed_at 列。
ALTER TABLE users DROP COLUMN password_changed_at;
