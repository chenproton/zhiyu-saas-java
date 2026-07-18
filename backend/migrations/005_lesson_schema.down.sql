-- 回滚课程域建表（005_lesson_schema.up.sql）
DROP TABLE IF EXISTS lesson_batches CASCADE;
DROP TABLE IF EXISTS course_knowledge_bindings CASCADE;
DROP TABLE IF EXISTS node_resources CASCADE;
DROP TABLE IF EXISTS hybrid_node_modules CASCADE;
DROP TABLE IF EXISTS node_homeworks CASCADE;
DROP TABLE IF EXISTS node_quiz_questions CASCADE;
DROP TABLE IF EXISTS node_quizzes CASCADE;
DROP TABLE IF EXISTS system_course_nodes CASCADE;
DROP TABLE IF EXISTS knowledge_points CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
