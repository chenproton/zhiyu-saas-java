SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE tenants DROP COLUMN short_name;
ALTER TABLE tenants DROP COLUMN school_type;
ALTER TABLE tenants DROP COLUMN province;
ALTER TABLE tenants DROP COLUMN city;
ALTER TABLE tenants DROP COLUMN website;
ALTER TABLE tenants DROP COLUMN contact_phone;
ALTER TABLE tenants DROP COLUMN scale_data;
ALTER TABLE tenants DROP COLUMN secondary_colleges;

SET FOREIGN_KEY_CHECKS = 1;