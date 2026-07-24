-- 为资源共享平台编排 app_modules 子模块
DELETE FROM app_modules WHERE platform = 'resource';

INSERT INTO app_modules (id, platform, title, description, href, sort_order) VALUES
  (gen_random_uuid(), 'resource', '知识点库', '各专业领域核心知识点与概念管理', '/library/knowledge', 1),
  (gen_random_uuid(), 'resource', '能力点库', '知识、技能、素质等多维度能力指标管理', '/library/ability', 2),
  (gen_random_uuid(), 'resource', '证书库', '职业技能证书收录与管理', '/library/certificates', 3),
  (gen_random_uuid(), 'resource', '场景资源库', '11种场景任务教学资源管理', '/library/resources', 4),
  (gen_random_uuid(), 'resource', '现场问答题库', '场景任务现场问答测评题目管理', '/library/questions', 5);
