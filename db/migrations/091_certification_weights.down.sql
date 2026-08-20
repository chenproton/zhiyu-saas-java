-- 091 down: 删除岗位能力认定权重表
SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP TABLE IF EXISTS certification_weights;

SET FOREIGN_KEY_CHECKS = 1;