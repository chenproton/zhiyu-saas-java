-- 修复删除租户时被阻断的级联删除链
-- 问题：多张表的 major_id 存在重复外键（自动命名的 *_major_id_fkey 为 NO ACTION，
-- 与已有的 fk_*_major ON DELETE SET NULL 重复），删除租户级联删除 majors 时被 NO ACTION 外键阻断。
-- 另有 exam_questions.question_id / exam_usages.exam_id 缺少 ON DELETE 动作。

-- 1) 删除与 fk_*_major (SET NULL) 重复的 NO ACTION 外键
ALTER TABLE batches                  DROP CONSTRAINT IF EXISTS batches_major_id_fkey;
ALTER TABLE scene_batches            DROP CONSTRAINT IF EXISTS scene_batches_major_id_fkey;
ALTER TABLE evaluation_batches       DROP CONSTRAINT IF EXISTS evaluation_batches_major_id_fkey;
ALTER TABLE lesson_batches           DROP CONSTRAINT IF EXISTS lesson_batches_major_id_fkey;
ALTER TABLE position_recommendations DROP CONSTRAINT IF EXISTS position_recommendations_major_id_fkey;
ALTER TABLE courses                  DROP CONSTRAINT IF EXISTS courses_major_id_fkey;
ALTER TABLE job_ability_results      DROP CONSTRAINT IF EXISTS job_ability_results_major_id_fkey;
ALTER TABLE exam_results             DROP CONSTRAINT IF EXISTS exam_results_major_id_fkey;

-- 2) 无重复项的 major_id 外键改为 SET NULL（与其他表保持一致）
DO $$ BEGIN ALTER TABLE student_ability_portraits DROP CONSTRAINT IF EXISTS student_ability_portraits_major_id_fkey; ALTER TABLE student_ability_portraits ADD CONSTRAINT fk_student_ability_portraits_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE graduation_query_results  DROP CONSTRAINT IF EXISTS graduation_query_results_major_id_fkey;  ALTER TABLE graduation_query_results  ADD CONSTRAINT fk_graduation_query_results_major  FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) 关联表外键改为 CASCADE（列 NOT NULL，删除题目/试卷时随之删除）
DO $$ BEGIN ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_question_id_fkey; ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE exam_usages    DROP CONSTRAINT IF EXISTS exam_usages_exam_id_fkey;        ALTER TABLE exam_usages    ADD CONSTRAINT exam_usages_exam_id_fkey        FOREIGN KEY (exam_id)     REFERENCES exams(id)     ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
