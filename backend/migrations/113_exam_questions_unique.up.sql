ALTER TABLE exam_questions
    ADD CONSTRAINT exam_questions_exam_question_key UNIQUE (exam_id, question_id);
