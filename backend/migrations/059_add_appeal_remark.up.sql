-- Add remark column to appeal_records for storing processing notes
ALTER TABLE appeal_records ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE appeal_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
