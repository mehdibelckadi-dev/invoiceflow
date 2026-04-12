-- pgvector: embeddings para RAG del AI Fiscal Assistant
CREATE TABLE vector_embeddings (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Origen del embedding
  entity_type VARCHAR(30)  NOT NULL,  -- 'invoice' | 'expense' | 'fiscal_note'
  entity_id   UUID         NOT NULL,
  -- Contenido resumido (para contexto en RAG)
  content     TEXT         NOT NULL,
  -- Embedding (Mistral mistral-embed: 1024 dims)
  embedding   vector(1024),
  -- Metadatos para filtrado
  period_year SMALLINT,
  period_month SMALLINT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índice ivfflat para búsqueda ANN (cosine distance)
-- Crear DESPUÉS de tener datos (requires >1000 rows para ser útil)
-- CREATE INDEX idx_embeddings_vector ON vector_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_embeddings_user_id     ON vector_embeddings(user_id);
CREATE INDEX idx_embeddings_entity      ON vector_embeddings(entity_type, entity_id);
CREATE INDEX idx_embeddings_user_period ON vector_embeddings(user_id, period_year, period_month);
