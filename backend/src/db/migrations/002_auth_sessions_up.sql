-- Persistent SEP-10 challenges and rotating refresh-token sessions.

CREATE TABLE IF NOT EXISTS auth_challenges (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce_hash       BYTEA       UNIQUE NOT NULL,
  nonce            TEXT        NOT NULL,
  wallet_address   VARCHAR(64) NOT NULL,
  transaction_xdr  TEXT        NOT NULL,
  transaction_hash BYTEA       NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  used_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires_at
  ON auth_challenges (expires_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID        NOT NULL,
  public_key  VARCHAR(64) NOT NULL,
  token_hash  BYTEA       UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  rotated_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  replaced_by UUID        REFERENCES auth_sessions (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_family_id ON auth_sessions (family_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_public_key ON auth_sessions (public_key);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_security_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT        NOT NULL,
  family_id   UUID,
  public_key  VARCHAR(64),
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_created_at
  ON auth_security_events (created_at);
