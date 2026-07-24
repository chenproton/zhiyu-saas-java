-- 063_make_evaluation_results_evaluator_nullable
ALTER TABLE scene_evaluation_results ALTER COLUMN evaluator_id DROP NOT NULL;
ALTER TABLE scene_evaluation_results ALTER COLUMN evaluator_type DROP NOT NULL;
