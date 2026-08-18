-- 158_snapshot_versioning: 资源快照与版本固化（阶段 1：快照表 + 版本列 + 删题保护）
-- 设计出处：docs/resource-snapshot-versioning.md 第 4 节

-- 通用资源快照表：五类资源（career_positions|scenarios|courses|exams|question_banks）
-- 每次发布在同一事务内写入一份整树 jsonb，UNIQUE(resource_type, resource_id, version) 幂等去重。
CREATE TABLE resource_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  resource_type varchar(32) NOT NULL,  -- career_positions|scenarios|courses|exams|question_banks
  resource_id uuid NOT NULL,
  version varchar(32) NOT NULL,
  snapshot_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
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
ALTER TABLE exam_questions ALTER COLUMN question_id DROP NOT NULL;
ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_question_id_fkey;
ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL;

-- 历史数据回填（尽力而为，精度仅影响改造前产生的数据；快照缺档时读取侧回退 live）
-- 排课条目 ← 当前课程/场景版本
UPDATE schedule_entries se SET resource_version = c.version FROM courses c WHERE se.course_id = c.id;
UPDATE schedule_entries se SET resource_version = s.version FROM scenarios s WHERE se.scenario_id = s.id;
-- 考试安排 ← 试卷当前版本
UPDATE exam_usages u SET exam_version = e.version FROM exams e WHERE u.exam_id = e.id;
-- 场景成绩 ← 场景当前版本（scene_id 可空，空则留空）
UPDATE scene_evaluation_results r SET version = s.version FROM scenarios s WHERE r.scene_id = s.id;
-- 节点成绩 ← 节点所属课程当前版本
UPDATE node_evaluation_results r SET version = c.version
FROM system_course_nodes n JOIN courses c ON c.id = n.course_id
WHERE r.node_id = n.id;
-- 课程成绩 ← 课程当前版本
UPDATE course_evaluation_results r SET version = c.version FROM courses c WHERE r.course_id = c.id;
-- 考试成绩 ← 考试安排的版本
UPDATE exam_results r SET version = u.exam_version FROM exam_usages u WHERE r.exam_usage_id = u.id;
