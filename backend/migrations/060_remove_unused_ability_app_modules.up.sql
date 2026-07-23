-- 删除门户应用中心中指向已移除页面的 ability 平台入口
DELETE FROM app_modules
WHERE platform = 'ability'
  AND href IN ('/evaluation/scene-results', '/evaluation/graduation/topics');
