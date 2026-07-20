-- Restore old columns to position_certificates
ALTER TABLE position_certificates
    ADD COLUMN name VARCHAR(128) NOT NULL DEFAULT '',
    ADD COLUMN url TEXT,
    ADD COLUMN description TEXT,
    ADD COLUMN image_url TEXT;

-- Copy data back from certificate_library
UPDATE position_certificates pc
SET
    name = cl.name,
    url = cl.url,
    description = cl.description,
    image_url = cl.image_url
FROM certificate_library cl
WHERE pc.certificate_library_id = cl.id;

-- Remove the FK and library column
ALTER TABLE position_certificates DROP CONSTRAINT IF EXISTS fk_position_certificates_library;
ALTER TABLE position_certificates DROP COLUMN certificate_library_id;

DROP INDEX IF EXISTS idx_position_certificates_library;

-- Drop certificate_library table
DROP TABLE IF EXISTS certificate_library CASCADE;
