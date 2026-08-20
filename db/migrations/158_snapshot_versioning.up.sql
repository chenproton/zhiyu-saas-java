-- 158_snapshot_versioning: 资源快照与版本固化（阶段 1：快照表 + 版本列 + 删题保护）
-- 设计出处：docs/resource-snapshot-versioning.md 第 4 节

-- 通用资源快照表：五类资源（career_positions|scenarios|courses|exams|question_banks）
-- 每次发布在同一事务内写入一份整树 JSON，UNIQUE(resource_type, resource_id, version) 幂等去重。
CREATE TABLE resource_snapshots (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tenant_id CHAR(36) NOT NULL,
  resource_type varchar(32) NOT NULL,  -- career_positions|scenarios|courses|exams|question_banks
  resource_id CHAR(36) NOT NULL,
  version varchar(32) NOT NULL,
  snapshot_data JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_resource_snapshots UNIQUE (resource_type, resource_id, version)
);
CREATE INDEX idx_resource_snapshots_res ON resource_snapshots (resource_type, resource_id);
-- 刻意设计：本表不加任何 FK（tenant_id / resource_id 均无外键约束）。
-- 快照是发布时刻的不可变存档，历史成绩回溯依赖它，资源或租户物理删除不得波及快照；
-- 项目 115/116 惯例为全库补 FK，此处为有意例外（scene_evaluation_results.task_id 无 FK 已有先例）。

-- 绑定/提交固化的版本列（服务端盖章，前端不可伪造）
ALTER TABLE schedule_entries ADD COLUMN resource_version varchar(32);
ALTER TABLE exam_usages    ADD COLUMN exam_version varchar(32);
ALTER TABLE scene_evaluation_results  ADD COLUMN version varchar(32);
ALTER TABLE node_evaluation_results   ADD COLUMN version varchar(32);
ALTER TABLE course_evaluation_results ADD COLUMN version varchar(32);
ALTER TABLE exam_results              ADD COLUMN version varchar(32);

-- 删题保护：已发布试卷的题目内容行（exam_questions 已是内容副本）不再因删题被级联毁掉
ALTER TABLE exam_questions MODIFY COLUMN question_id CHAR(36) NULL;
ALTER TABLE exam_questions DROP FOREIGN KEY exam_questions_question_id_fkey;
ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL;

-- 历史数据回填（尽力而为，精度仅影响改造前产生的数据；快照缺档时读取侧回退 live）
-- 排课条目 ← 当前课程/场景版本
UPDATE schedule_entries se JOIN courses c ON se.course_id = c.id SET se.resource_version = c.version;
UPDATE schedule_entries se JOIN scenarios s ON se.scenario_id = s.id SET se.resource_version = s.version;
-- 考试安排 ← 试卷当前版本
UPDATE exam_usages u JOIN exams e ON u.exam_id = e.id SET u.exam_version = e.version;
-- 场景成绩 ← 场景当前版本（scene_id 可空，空则留空）
UPDATE scene_evaluation_results r JOIN scenarios s ON r.scene_id = s.id SET r.version = s.version;
-- 节点成绩 ← 节点所属课程当前版本
UPDATE node_evaluation_results r
JOIN system_course_nodes n ON r.node_id = n.id
JOIN courses c ON c.id = n.course_id
SET r.version = c.version;
-- 课程成绩 ← 课程当前版本
UPDATE course_evaluation_results r JOIN courses c ON r.course_id = c.id SET r.version = c.version;
-- 考试成绩 ← 考试安排的版本
UPDATE exam_results r JOIN exam_usages u ON r.exam_usage_id = u.id SET r.version = u.exam_version;
