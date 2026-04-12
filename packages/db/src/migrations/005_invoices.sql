CREATE TABLE invoices (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Numeración
  serie             VARCHAR(10)  NOT NULL DEFAULT 'A',
  numero            INTEGER      NOT NULL,
  numero_completo   VARCHAR(50)  GENERATED ALWAYS AS (serie || '-' || EXTRACT(YEAR FROM fecha_emision)::TEXT || '-' || LPAD(numero::TEXT, 4, '0')) STORED,
  -- Estado
  status            VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    -- DRAFT | PENDING_SEAL | SEALED | SENT | PAID | VOID
  -- Receptor
  cliente_nombre    VARCHAR(255) NOT NULL,
  cliente_nif       VARCHAR(15),
  cliente_email     VARCHAR(255),
  cliente_domicilio TEXT,
  -- Fechas
  fecha_emision     DATE         NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  -- Totales (calculados y almacenados para inmutabilidad)
  base_imponible    NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva_porcentaje    NUMERIC(5,2)  NOT NULL DEFAULT 21,
  iva_importe       NUMERIC(12,2) NOT NULL DEFAULT 0,
  irpf_porcentaje   NUMERIC(5,2)  NOT NULL DEFAULT 0,
  irpf_importe      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- PDF
  pdf_url           TEXT,
  -- Notas
  concepto          TEXT,
  notas             TEXT,
  -- Sellada
  sealed_at         TIMESTAMPTZ,
  -- Campos Verifactu
  verifactu_id      UUID,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, serie, numero)
);

CREATE INDEX idx_invoices_user_id    ON invoices(user_id);
CREATE INDEX idx_invoices_status     ON invoices(user_id, status);
CREATE INDEX idx_invoices_fecha      ON invoices(user_id, fecha_emision DESC);
CREATE INDEX idx_invoices_numero     ON invoices(user_id, serie, numero);
