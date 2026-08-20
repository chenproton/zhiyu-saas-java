-- 160_password_changed_at: 用户改密时间戳，用于「改密后旧 token 失效」。
-- JWT 签发时间（iat）早于 password_changed_at 的令牌视为过期（auth 中间件逐请求校验）。
ALTER TABLE users ADD COLUMN password_changed_at timestamptz NOT NULL DEFAULT now();
