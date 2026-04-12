-- Schema separado para registros fiscales inmutables
CREATE TABLE verifactu.verifactu_records (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            UUID         UNIQUE NOT NULL REFERENCES invoices(id),
  user_id               UUID         NOT NULL REFERENCES users(id),
  -- XML generado según RD 1007/2023
  xml_payload           TEXT         NOT NULL,
  -- Hash SHA-256 encadenado
  hash_registro         VARCHAR(64)  NOT NULL,   -- SHA-256 de este registro
  hash_registro_anterior VARCHAR(64),            -- NULL si es el primero
  -- Firma eIDAS (Uanataca)
  signature_id          VARCHAR(255),
  signature_timestamp   TIMESTAMPTZ,
  certificate_id        VARCHAR(255),
  -- Envío a AEAT
  aeat_status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    -- PENDING | SIGNING | SUBMITTED | ACCEPTED | REJECTED | ERROR
  aeat_response_code    VARCHAR(50),
  aeat_response_msg     TEXT,
  aeat_submitted_at     TIMESTAMPTZ,
  aeat_accepted_at      TIMESTAMPTZ,
  -- Reintentos
  retry_count           SMALLINT     NOT NULL DEFAULT 0,
  next_retry_at         TIMESTAMPTZ,
  -- Auditoría (append-only)
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  -- SIN updated_at — registro inmutable
);

CREATE INDEX idx_verifactu_user_id    ON verifactu.verifactu_records(user_id);
CREATE INDEX idx_verifactu_invoice_id ON verifactu.verifactu_records(invoice_id);
CREATE INDEX idx_verifactu_status     ON verifactu.verifactu_records(aeat_status);
CREATE INDEX idx_verifactu_hash       ON verifactu.verifactu_records(hash_registro);

-- TRIGGER CRÍTICO: bloquea UPDATE y DELETE (inmutabilidad legal Verifactu)
CREATE OR REPLACE FUNCTION verifactu.verifactu_records_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION
      'verifactu_records es append-only: UPDATE no permitido. Record ID: %. Violación de RD 1007/2023.',
      OLD.id;
  END IF;
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION
      'verifactu_records es append-only: DELETE no permitido. Record ID: %. Violación de RD 1007/2023 y retención mínima 4 años.',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verifactu_records_immutable_trigger
BEFORE UPDATE OR DELETE ON verifactu.verifactu_records
FOR EACH ROW EXECUTE FUNCTION verifactu.verifactu_records_immutable();
