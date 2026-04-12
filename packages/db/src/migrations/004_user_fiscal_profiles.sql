CREATE TABLE user_fiscal_profiles (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nif             VARCHAR(15)  UNIQUE,            -- NIF/NIE/CIF validado
  nombre_fiscal   VARCHAR(255),
  regimen_iva     VARCHAR(50)  DEFAULT 'GENERAL', -- GENERAL|SIMPLIFICADO|RECARGO_EQUIVALENCIA|EXENTO
  epigrafe_iae    VARCHAR(10),
  domicilio       TEXT,
  municipio       VARCHAR(255),
  provincia       VARCHAR(100),
  cod_postal      VARCHAR(10),
  pais            VARCHAR(2)   DEFAULT 'ES',
  serie_default   VARCHAR(10)  DEFAULT 'A',       -- Serie de facturación por defecto
  siguiente_num   INTEGER      NOT NULL DEFAULT 1, -- Siguiente número en la serie
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_fiscal_profiles_user_id ON user_fiscal_profiles(user_id);
CREATE INDEX idx_user_fiscal_profiles_nif     ON user_fiscal_profiles(nif);
