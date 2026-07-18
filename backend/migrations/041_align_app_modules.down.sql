-- 回滚 /portal/apps 应用服务子模块到调整前状态
DELETE FROM app_modules WHERE platform IN ('career', 'course', 'scene', 'ability');

INSERT INTO app_modules (id, platform, title, description, href, sort_order) VALUES
  -- 职业岗位学习平台
  ('263d7390-30a1-4b90-9b42-eb77109a7025', 'career', '岗位管理', '产业岗位与学习路径', '/job/positions', 1),
  ('052b5761-0201-4d3f-8b9c-a53bdaa20420', 'career', '批次管理', '岗位批次与推荐', '/job/batches', 2),

  -- 数字课程服务平台
  ('1873869d-c489-4a20-bd5b-2ff03fa0991c', 'course', '体系课管理', '体系课程资源建设', '/lesson/admin/system', 1),
  ('00771d45-8f59-4b04-bf55-09eee0860594', 'course', '颗粒课管理', '颗粒化课程资源', '/lesson/admin/granular', 2),
  ('aaaaaaaa-1111-1111-1111-111111111143', 'course', '混合课管理', '混合课模板与档案', '/lesson/admin/hybrid', 3),

  -- 实践场景学习平台
  ('03b43046-a99e-434e-8453-1356666e9f09', 'scene', '场景管理', '实践场景与任务设计', '/scene/', 1),
  ('0e6357db-50bc-4ab4-b6b3-e3601c5ad4b8', 'scene', '场景归档', '历史场景档案库', '/scene/archive', 2),

  -- 能力评价与测评资源管理平台
  ('0c5e5f90-abb6-404a-a5eb-4597900e26b9', 'ability', '题库管理', '测评题库与试卷', '/evaluation/question-banks', 1),
  ('02c336fc-b994-4d6f-a3c6-70de6bda92dc', 'ability', '考试管理', '考试场次与结果', '/evaluation/exam-usage', 2),
  ('217b72f2-6acd-41cd-9340-9289fbd02d56', 'ability', '微证书', '认证规则与颁发', '/evaluation/certificates/templates', 3);
