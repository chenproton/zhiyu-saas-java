-- Add extra_data JSONB to task_resources to persist type-specific fields from the scenario task editor
ALTER TABLE task_resources ADD COLUMN IF NOT EXISTS extra_data JSONB NOT NULL DEFAULT '{}';
