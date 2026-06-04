-- Stores per-user Gmail OAuth connections for user-owned report sending.

BEGIN;

CREATE TABLE IF NOT EXISTS user_gmail_connections (
  user_id                 UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  gmail_email             TEXT        NOT NULL,
  encrypted_refresh_token TEXT        NOT NULL,
  scope                   TEXT,
  token_type              TEXT,
  connected_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gmail_oauth_states (
  state       TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  return_to   TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gmail_oauth_states_expires
  ON gmail_oauth_states (expires_at);

ALTER TABLE sent_emails
  ADD COLUMN IF NOT EXISTS sender_email TEXT;

COMMIT;
