CREATE TABLE billing.plans (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     VARCHAR(20)   UNIQUE NOT NULL,
  name                     VARCHAR(50)   NOT NULL,
  stripe_product_id        VARCHAR(50),
  invoice_limit            INTEGER       NOT NULL DEFAULT 5,   -- -1 = ilimitado
  ocr_limit                INTEGER       NOT NULL DEFAULT 3,
  ai_daily_limit           INTEGER       NOT NULL DEFAULT 5,
  email_limit              INTEGER       NOT NULL DEFAULT 10,
  price_monthly_eur        NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_annual_eur         NUMERIC(10,2) NOT NULL DEFAULT 0,
  stripe_price_monthly_id  VARCHAR(50),
  stripe_price_annual_id   VARCHAR(50),
  is_active                BOOLEAN       NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

INSERT INTO billing.plans (slug, name, invoice_limit, ocr_limit, ai_daily_limit, email_limit, price_monthly_eur, price_annual_eur) VALUES
  ('free',    'Lefse FREE',     5,   3,   5,  10,  0.00,   0.00),
  ('starter', 'Lefse STARTER',  30,  20,  20, 50,  9.00,   86.40),
  ('pro',     'Lefse PRO',      150, 100, -1, -1,  29.00,  278.40),
  ('agency',  'Lefse AGENCY',   -1,  -1,  -1, -1,  79.00,  758.40);

CREATE TABLE billing.subscriptions (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID         UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id                 UUID         NOT NULL REFERENCES billing.plans(id),
  stripe_subscription_id  VARCHAR(100) UNIQUE,
  stripe_customer_id      VARCHAR(100),
  status                  VARCHAR(30)  NOT NULL DEFAULT 'active',
  billing_period          VARCHAR(10),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN      NOT NULL DEFAULT false,
  at_risk                 BOOLEAN      NOT NULL DEFAULT false,
  trial_end               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id          ON billing.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer   ON billing.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status            ON billing.subscriptions(status);

CREATE TABLE billing.usage_tracking (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month      VARCHAR(7)  NOT NULL,  -- 'YYYY-MM'
  invoices_count    INTEGER     NOT NULL DEFAULT 0,
  ocr_count         INTEGER     NOT NULL DEFAULT 0,
  ai_queries_count  INTEGER     NOT NULL DEFAULT 0,
  email_count       INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period_month)
);

CREATE INDEX idx_usage_tracking_user_period ON billing.usage_tracking(user_id, period_month);

CREATE TABLE billing.billing_events (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id     VARCHAR(100) UNIQUE NOT NULL,
  event_type          VARCHAR(80)  NOT NULL,
  user_id             UUID         REFERENCES users(id),
  stripe_customer_id  VARCHAR(100),
  payload             JSONB        NOT NULL,
  processed_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_events_stripe_id ON billing.billing_events(stripe_event_id);
CREATE INDEX idx_billing_events_user_id   ON billing.billing_events(user_id);

CREATE OR REPLACE FUNCTION billing.billing_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION 'billing_events es append-only: UPDATE no permitido. ID: %', OLD.id;
  END IF;
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'billing_events es append-only: DELETE no permitido. ID: %', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_events_immutable_trigger
BEFORE UPDATE OR DELETE ON billing.billing_events
FOR EACH ROW EXECUTE FUNCTION billing.billing_events_immutable();
