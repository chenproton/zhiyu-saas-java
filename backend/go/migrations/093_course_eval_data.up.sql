ALTER TABLE courses ADD COLUMN IF NOT EXISTS eval_data jsonb DEFAULT '{}'::jsonb NOT NULL;
