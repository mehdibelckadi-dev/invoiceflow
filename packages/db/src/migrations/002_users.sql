CREATE TABLE users (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email               VARCHAR(255) UNIQUE NOT NULL,
  email_verified      BOOLEAN      NOT NULL DEFAULT false,
  name                VARCHAR(255) NOT NULL,
  avatar_url          TEXT,
  password_hash       TEXT,                    -- NULL si solo OAuth
  google_id           VARCHAR(255) UNIQUE,
  totp_secret         TEXT,                    -- cifrado en app
  totp_enabled        BOOLEAN      NOT NULL DEFAULT false,
  plan                VARCHAR(20)  NOT NULL DEFAULT 'free',
  stripe_customer_id  VARCHAR(100),
  inbox_hash          VARCHAR(64)  UNIQUE NOT NULL, -- {hash}@inbox.lefse.io
  is_active           BOOLEAN      NOT NULL DEFAULT true,
  -- RGPD: anonimización (no borrado físico)
  anonymized_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email          ON users(email);
CREATE INDEX idx_users_google_id      ON users(google_id);
CREATE INDEX idx_users_inbox_hash     ON users(inbox_hash);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX idx_users_plan           ON users(plan);
