-- 回滚 162_alliance_employment：删除就业服务三表。
-- 不可逆：DROP TABLE 后表内业务数据（就业项目/岗位/投递）不可恢复。
SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP TABLE IF EXISTS alliance_employment_applications;
DROP TABLE IF EXISTS alliance_employment_jobs;
DROP TABLE IF EXISTS alliance_employment_projects;

SET FOREIGN_KEY_CHECKS = 1;