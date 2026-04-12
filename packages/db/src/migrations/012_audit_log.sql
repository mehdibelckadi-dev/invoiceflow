-- Audit log inmutable (INSERT-only, trigger bloquea UPDATE/DELETE)
CREATE TABLE audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,  -- INVOICE_CREATED, SEAL_REQUESTED, etc.
  entity_type VARCHAR(50),
  entity_id   UUID,
  metadata    JSONB,
  ip          INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id    ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_entity     ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_action     ON audit_log(action);

-- Trigger inmutabilidad
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION 'audit_log es append-only: UPDATE no permitido. ID: %', OLD.id;
  END IF;
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'audit_log es append-only: DELETE no permitido. ID: %', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable_trigger
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
