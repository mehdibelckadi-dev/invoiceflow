CREATE TABLE email_inbound_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
    -- PROCESSING | PENDING_REVIEW | APPROVED | REJECTED | ERROR
  -- Email origen
  from_email      VARCHAR(255),
  from_name       VARCHAR(255),
  subject         TEXT,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mailgun_id      VARCHAR(255) UNIQUE,
  -- Adjuntos procesados
  attachments     JSONB,       -- [{ filename, mime, size, r2_key }]
  -- Resultado
  draft_invoice_id UUID REFERENCES invoices(id),
  ocr_job_id      UUID REFERENCES ocr_jobs(id),
  -- Error
  error_msg       TEXT,
  -- Revisión
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_inbound_user_id     ON email_inbound_items(user_id);
CREATE INDEX idx_email_inbound_status      ON email_inbound_items(user_id, status);
CREATE INDEX idx_email_inbound_received_at ON email_inbound_items(user_id, received_at DESC);
