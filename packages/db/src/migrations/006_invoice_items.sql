CREATE TABLE invoice_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  descripcion     TEXT          NOT NULL,
  cantidad        NUMERIC(10,3) NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL,
  iva_porcentaje  NUMERIC(5,2)  NOT NULL DEFAULT 21,
  irpf_porcentaje NUMERIC(5,2)  NOT NULL DEFAULT 0,
  subtotal        NUMERIC(12,2) NOT NULL,  -- cantidad × precio_unitario
  posicion        SMALLINT      NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
