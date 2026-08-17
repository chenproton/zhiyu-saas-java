-- 清空联盟字典种子（按 dict_type 删除，保留用户自建其他类型）
DELETE FROM alliance_dictionaries
WHERE dict_type IN ('cooperation_type','cooperation_rating','enterprise_status',
    'achievement_type','agreement_type','agreement_status','expert_rating','project_type');
