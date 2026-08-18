-- 回滚 162_alliance_employment：删除就业服务三表。
-- 不可逆：DROP TABLE 后表内业务数据（就业项目/岗位/投递）不可恢复。
DROP TABLE IF EXISTS alliance_employment_applications;
DROP TABLE IF EXISTS alliance_employment_jobs;
DROP TABLE IF EXISTS alliance_employment_projects;
