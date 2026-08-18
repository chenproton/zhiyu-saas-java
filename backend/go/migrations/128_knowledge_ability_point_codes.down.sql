-- 回退知识点编码回填：仅清空本迁移生成的 KP- 前缀编码（NL- 部分与 120 down 重叠，由 120 处理）。
UPDATE knowledge_points SET code = NULL WHERE code LIKE 'KP-%';
