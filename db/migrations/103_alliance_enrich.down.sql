SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE alliance_brands DROP COLUMN student_id;
ALTER TABLE alliance_brands DROP COLUMN enterprise_id;
ALTER TABLE alliance_brands DROP COLUMN position_id;
ALTER TABLE alliance_brands DROP COLUMN major_id;
ALTER TABLE alliance_brands DROP COLUMN teacher_id;
ALTER TABLE alliance_brands DROP COLUMN expert_id;
ALTER TABLE alliance_projects DROP COLUMN agreement_ids;
ALTER TABLE alliance_achievements DROP COLUMN citation_reason;
ALTER TABLE alliance_achievements DROP COLUMN images;
ALTER TABLE alliance_achievements DROP COLUMN owner_persons;
ALTER TABLE alliance_achievements DROP COLUMN co_builders;
ALTER TABLE alliance_experts DROP COLUMN cover_image;
ALTER TABLE alliance_experts DROP COLUMN partner_source;
ALTER TABLE alliance_experts DROP COLUMN position_direction;

SET FOREIGN_KEY_CHECKS = 1;