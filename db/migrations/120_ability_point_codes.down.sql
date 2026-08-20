-- 回退能力点编码回填：仅清空本迁移生成的 NL- 前缀编码。
UPDATE ability_points SET code = NULL WHERE code LIKE 'NL-%';
