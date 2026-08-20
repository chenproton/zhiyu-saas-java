-- 回滚 142_partner_enterprise：
-- 删新表 → experts 删 user_id → 企业主体回改表名并还原删掉的列 → 删 tenants.type。
-- 注意：up 中 TRUNCATE 清空的联盟开发数据不可逆（无法通过本回滚恢复）。

SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP TABLE IF EXISTS alliance_expert_mentor_links;
DROP TABLE IF EXISTS alliance_enterprise_links;

ALTER TABLE alliance_experts DROP COLUMN user_id;
DROP INDEX idx_alliance_experts_enterprise ON alliance_experts;

-- ===== 企业主体回改：partner_enterprises → alliance_enterprises =====
ALTER TABLE partner_enterprises DROP INDEX partner_enterprises_name_key;
ALTER TABLE partner_enterprises DROP COLUMN enable_public;

ALTER TABLE partner_enterprises ADD COLUMN enterprise_type varchar(32) NOT NULL DEFAULT 'platform';
ALTER TABLE partner_enterprises ADD COLUMN rating varchar(32) DEFAULT 'general';
ALTER TABLE partner_enterprises ADD COLUMN status varchar(32) NOT NULL DEFAULT 'negotiating';
ALTER TABLE partner_enterprises ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE partner_enterprises ADD COLUMN secondary_colleges JSON DEFAULT (JSON_ARRAY());
ALTER TABLE partner_enterprises ADD COLUMN rating_record JSON;
ALTER TABLE partner_enterprises ADD COLUMN created_by CHAR(36);

DROP INDEX idx_partner_enterprises_tenant ON partner_enterprises;
ALTER TABLE partner_enterprises RENAME TO alliance_enterprises;


ALTER TABLE tenants DROP COLUMN type;

SET FOREIGN_KEY_CHECKS = 1;