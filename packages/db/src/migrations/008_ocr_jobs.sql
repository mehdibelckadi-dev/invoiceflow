CREATE TABLE ocr_jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING | PROCESSING | COMPLETED | FAILED
  -- Archivo original (eliminado tras 24h RGPD)
  r2_key          TEXT,                    -- NULL tras eliminación
  original_name   VARCHAR(255),
  mime_type       VARCHAR(100),
  file_size       INTEGER,
  r2_expires_at   TIMESTAMPTZ,            -- 24h tras upload
  -- Resultado OCR
  result          JSONB,                   -- campos extraídos con score
  confidence_avg  NUMERIC(4,3),           -- score promedio 0-1
  -- Factura creada (si se aprobó)
  invoice_id      UUID REFERENCES invoices(id),
  -- Error
  error_msg       TEXT,
  -- Tiempos
  queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ocr_jobs_user_id    ON ocr_jobs(user_id);
CREATE INDEX idx_ocr_jobs_status     ON ocr_jobs(user_id, status);
CREATE INDEX idx_ocr_jobs_expires_at ON ocr_jobs(r2_expires_at) WHERE r2_key IS NOT NULL;
