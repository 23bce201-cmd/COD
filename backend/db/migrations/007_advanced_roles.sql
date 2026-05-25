-- CloudCRM — Advanced Role Hierarchy Migrations
-- Run: node db/run_005_migration.js

BEGIN;

-- 1. Create manager_client_assignments table
CREATE TABLE IF NOT EXISTS manager_client_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (manager_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_mca_manager   ON manager_client_assignments (manager_id);
CREATE INDEX IF NOT EXISTS idx_mca_client    ON manager_client_assignments (client_id);

-- 2. Add manager_id to users (to assign employees to managers)
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_manager ON users (manager_id);

-- 3. Add employee_id to campaigns (to assign campaigns to employees)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_employee ON campaigns (employee_id);

COMMIT;
