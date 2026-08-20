-- 联盟字典：合作类型/协议类型/项目类型 编码由中文改为英文，与其他字典（评级/状态/成果类型）保持一致
-- 说明：业务表（alliance_projects.type、alliance_agreements.type、alliance_enterprises.cooperation_types）
-- 仍存储中文文本，本次仅调整 alliance_dictionaries 的 code 列。
-- MySQL 版：PG UPDATE...FROM(VALUES) 改 UPDATE JOIN (VALUES)；NOT EXISTS 引用目标表改 LEFT JOIN IS NULL。
UPDATE alliance_dictionaries d
JOIN (VALUES
    -- 合作类型 cooperation_type
    ROW('cooperation_type', '人才培养', 'talent_training'),
    ROW('cooperation_type', '实习实训', 'internship'),
    ROW('cooperation_type', '技术研发', 'tech_rd'),
    ROW('cooperation_type', '课程共建', 'course_co_build'),
    ROW('cooperation_type', '师资培训', 'teacher_training'),
    ROW('cooperation_type', '就业合作', 'employment'),
    -- 协议类型 agreement_type
    ROW('agreement_type', '战略合作协议', 'strategic'),
    ROW('agreement_type', '产学研合作协议', 'industry_academia_research'),
    ROW('agreement_type', '实习实训协议', 'internship'),
    ROW('agreement_type', '人才培养协议', 'talent_training'),
    ROW('agreement_type', '就业合作协议', 'employment'),
    ROW('agreement_type', '课程共建协议', 'course_co_build'),
    ROW('agreement_type', '技术服务协议', 'technical_service'),
    -- 项目类型 project_type
    ROW('project_type', '人才培养项目', 'talent_training'),
    ROW('project_type', '技术研发项目', 'tech_rd'),
    ROW('project_type', '基地建设项目', 'base_construction'),
    ROW('project_type', '技能竞赛项目', 'skill_competition'),
    ROW('project_type', '创新创业项目', 'innovation_startup'),
    ROW('project_type', '师资培训项目', 'teacher_training'),
    ROW('project_type', '课程开发项目', 'course_development'),
    ROW('project_type', '专业共建项目', 'major_co_build')
) AS m(dict_type, old_code, new_code)
  ON d.dict_type = m.dict_type AND d.code = m.old_code
LEFT JOIN alliance_dictionaries d2
  ON d2.tenant_id = d.tenant_id AND d2.dict_type = d.dict_type AND d2.code = m.new_code
SET d.code = m.new_code
WHERE d2.id IS NULL;
