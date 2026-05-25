-- CloudCRM — Drop Legacy Assignments Table Migration
-- Run: node db/run_008_migration.js

BEGIN;

DROP TABLE IF EXISTS employee_client_assignments CASCADE;

COMMIT;
