-- 对齐 /portal/apps 应用服务子模块与各子系统一级导航
DELETE FROM app_modules WHERE platform IN ('career', 'course', 'scene', 'ability');

INSERT INTO app_modules (id, platform, title, description, href, sort_order) VALUES
  -- 职业岗位学习平台
  (gen_random_uuid(), 'career', '岗位中心', '产业岗位标准管理', '/job/positions', 1),
  (gen_random_uuid(), 'career', '推荐与学习', '岗位推荐与学习路径', '/job/recommend', 2),
  (gen_random_uuid(), 'career', '批次与审批管理', '岗位批次与审批流程', '/job/batches', 3),

  -- 数字课程服务平台
  (gen_random_uuid(), 'course', '在线课资源库', '体系课与颗粒课管理', '/lesson/admin/system', 1),
  (gen_random_uuid(), 'course', '混合课资源库', '混合课模板与历史档案', '/lesson/admin/hybrid', 2),
  (gen_random_uuid(), 'course', '教学空间', '开课计划与教学跟踪', '/lesson/teacher/claim', 3),
  (gen_random_uuid(), 'course', '批次与审批管理', '课程批次与审批流程', '/lesson/admin/batches', 4),

  -- 实践场景学习平台
  (gen_random_uuid(), 'scene', '场景中心', '实践场景与任务设计', '/scene/', 1),
  (gen_random_uuid(), 'scene', '批次与审批管理', '场景批次与审批流程', '/scene/batches', 2),

  -- 能力评价与测评资源管理平台
  (gen_random_uuid(), 'ability', '测评资源', '题库、试卷与考试管理', '/evaluation/question-banks', 1),
  (gen_random_uuid(), 'ability', '批次与审批管理', '测评批次与审批流程', '/evaluation/batches', 2),
  (gen_random_uuid(), 'ability', '结果与认证', '场景结果与微证书', '/evaluation/scene-results', 3),
  (gen_random_uuid(), 'ability', '毕业与画像', '毕业设计与学生画像', '/evaluation/graduation/topics', 4);
