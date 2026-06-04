-- Creates sent email audit log for report email automation.

BEGIN;

CREATE TABLE IF NOT EXISTS sent_emails (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  client_id           UUID        REFERENCES clients(id) ON DELETE SET NULL,
  recipient_user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  recipient_email     TEXT        NOT NULL,
  subject             TEXT        NOT NULL,
  report_title        TEXT,
  report_from         DATE,
  report_to           DATE,
  attachment_filename TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'scheduled', 'failed')),
  scheduled_for       TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  provider_message_id TEXT,
  error_message       TEXT,
  metadata            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sent_emails_sender_created
  ON sent_emails (sender_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sent_emails_client_created
  ON sent_emails (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sent_emails_status_scheduled
  ON sent_emails (status, scheduled_for);

COMMIT;
