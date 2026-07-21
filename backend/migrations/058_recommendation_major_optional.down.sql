-- 岗位推荐 major_id 恢复非空
ALTER TABLE position_recommendations ALTER COLUMN major_id SET NOT NULL;
