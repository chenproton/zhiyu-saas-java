-- 回滚：移除唯一索引（去重删除的数据不可恢复，属可接受损失）
DROP INDEX IF EXISTS uq_institution_expertise_tags;
