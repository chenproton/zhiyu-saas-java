-- 岗位推荐 major_id 改为可选，支持全局推荐
ALTER TABLE position_recommendations ALTER COLUMN major_id DROP NOT NULL;
