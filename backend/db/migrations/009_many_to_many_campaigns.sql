-- CloudCRM — Many-to-Many Employee Campaign Assignments Migration
-- Run: node db/run_009_migration.js

BEGIN;

-- 1. Create the join table for employee campaign assignments
CREATE TABLE IF NOT EXISTS employee_campaign_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id   UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_eca_emp ON employee_campaign_assignments (employee_id);
CREATE INDEX IF NOT EXISTS idx_eca_camp ON employee_campaign_assignments (campaign_id);

-- 2. Migrating existing assignments if any
INSERT INTO employee_campaign_assignments (employee_id, campaign_id)
SELECT employee_id, id FROM campaigns 
WHERE employee_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Drop obsolete column from campaigns
ALTER TABLE campaigns DROP COLUMN IF EXISTS employee_id CASCADE;

COMMIT;
