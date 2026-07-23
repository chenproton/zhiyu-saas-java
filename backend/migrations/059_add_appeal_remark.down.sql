-- Remove remark and updated_at columns from appeal_records
ALTER TABLE appeal_records DROP COLUMN IF EXISTS remark;
ALTER TABLE appeal_records DROP COLUMN IF EXISTS updated_at;
