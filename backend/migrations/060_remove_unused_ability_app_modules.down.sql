-- 回滚：恢复 ability 平台已删除的应用入口
INSERT INTO app_modules (id, platform, title, description, href, sort_order) VALUES
  (gen_random_uuid(), 'ability', '结果与认证', '场景结果与微证书', '/evaluation/scene-results', 3),
  (gen_random_uuid(), 'ability', '毕业与画像', '毕业设计与学生画像', '/evaluation/graduation/topics', 4);
