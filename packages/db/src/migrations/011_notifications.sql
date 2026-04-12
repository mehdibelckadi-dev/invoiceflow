CREATE TABLE notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(20) NOT NULL,  -- FISCAL_ALERT | TIP | NEWS | SYSTEM | PROMO
  title      VARCHAR(255) NOT NULL,
  body       TEXT         NOT NULL,
  action_url TEXT,
  read       BOOLEAN      NOT NULL DEFAULT false,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_type    ON notifications(user_id, type);
