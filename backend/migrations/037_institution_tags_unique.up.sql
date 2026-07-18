-- institution_expertise_tags 补 (institution_id, tag_value) 唯一索引：
-- 代码中的 ON CONFLICT (institution_id, tag_value) 依赖该约束，缺失导致保存标签必然 500。
DELETE FROM institution_expertise_tags a USING institution_expertise_tags b
WHERE a.ctid < b.ctid AND a.institution_id = b.institution_id AND a.tag_value = b.tag_value;

CREATE UNIQUE INDEX IF NOT EXISTS uq_institution_expertise_tags
    ON institution_expertise_tags(institution_id, tag_value);
