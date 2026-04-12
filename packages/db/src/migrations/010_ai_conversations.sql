CREATE TABLE ai_conversations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(255),  -- generado del primer mensaje
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id, created_at DESC);

CREATE TABLE ai_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID        NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             VARCHAR(20) NOT NULL,  -- 'user' | 'assistant'
  -- Contenido cifrado en app layer
  content_encrypted TEXT        NOT NULL,
  -- Metadata
  response_type    VARCHAR(30), -- 'dato_exacto' | 'consejo_fiscal' | 'conversacional'
  tokens_used      INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at ASC);
CREATE INDEX idx_ai_messages_user_id      ON ai_messages(user_id);
