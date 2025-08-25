-- Migration 002: Add subscribed column to channels table

--  Add subscribed flag to table
ALTER TABLE channels ADD COLUMN subscribed BOOLEAN;

-- Set all existing rows to true 
UPDATE channels SET subscribed = true WHERE subscribed IS NULL;

-- Cannot be null, and default to false
ALTER TABLE channels ALTER COLUMN subscribed SET NOT NULL;
ALTER TABLE channels ALTER COLUMN subscribed SET DEFAULT false;