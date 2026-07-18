-- 回滚：恢复原有 NO ACTION 外键

-- 3) 关联表外键改回 NO ACTION
DO $$ BEGIN ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_question_id_fkey; ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES questions(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE exam_usages    DROP CONSTRAINT IF EXISTS exam_usages_exam_id_fkey;        ALTER TABLE exam_usages    ADD CONSTRAINT exam_usages_exam_id_fkey        FOREIGN KEY (exam_id)     REFERENCES exams(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) 恢复自动命名的 major_id 外键
DO $$ BEGIN ALTER TABLE student_ability_portraits DROP CONSTRAINT IF EXISTS fk_student_ability_portraits_major; ALTER TABLE student_ability_portraits ADD CONSTRAINT student_ability_portraits_major_id_fkey FOREIGN KEY (major_id) REFERENCES majors(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE graduation_query_results  DROP CONSTRAINT IF EXISTS fk_graduation_query_results_major;  ALTER TABLE graduation_query_results  ADD CONSTRAINT graduation_query_results_major_id_fkey  FOREIGN KEY (major_id) REFERENCES majors(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) 恢复重复的 NO ACTION 外键
DO $$ BEGIN ALTER TABLE batches                  ADD CONSTRAINT batches_major_id_fkey                  FOREIGN KEY (major_id) REFERENCES majors(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE scene_batches            ADD CONSTRAINT scene_batches_major_id_fkey            FOREIGN KEY (major_id) REFERENCES majors(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE evaluation_batches       ADD CONSTRAINT evaluation_batches_major_id_fkey       FOREIGN KEY (major_id) REFERENCES majors(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE lesson_batches           ADD CONSTRAINT lesson_batches_major_id_fkey           FOREIGN KEY (major_id) REFERENCES majors(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE position_recommendations ADD CONSTRAINT position_recommendations_major_id_fkey FOREIGN KEY (major_id) REFERENCES majors(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE courses                  ADD CONSTRAINT courses_major_id_fkey                  FOREIGN KEY (major_id) REFERENCES majors(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE job_ability_results      ADD CONSTRAINT job_ability_results_major_id_fkey      FOREIGN KEY (major_id) REFERENCES majors(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE exam_results             ADD CONSTRAINT exam_results_major_id_fkey             FOREIGN KEY (major_id) REFERENCES majors(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
