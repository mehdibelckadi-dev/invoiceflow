import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  UANATACA_API_URL: z.string().url(),
  UANATACA_API_KEY: z.string(),
  UANATACA_CERTIFICATE_ID: z.string(),
  AEAT_VERIFACTU_URL_SANDBOX: z.string().url(),
  AEAT_VERIFACTU_URL_PROD: z.string().url(),
  AEAT_ENV: z.enum(['sandbox', 'prod']).default('sandbox'),
  MINDEE_API_KEY: z.string(),
  MINDEE_API_URL: z.string().url(),
  MISTRAL_API_KEY: z.string(),
  MISTRAL_API_URL: z.string().url(),
  MISTRAL_MODEL: z.string().default('mistral-large-latest'),
  MISTRAL_EMBED_MODEL: z.string().default('mistral-embed'),
  MAILGUN_API_KEY: z.string(),
  MAILGUN_DOMAIN: z.string(),
  MAILGUN_WEBHOOK_SIGNING_KEY: z.string(),
  MAILGUN_API_URL: z.string().url(),
  R2_ACCOUNT_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET_NAME: z.string(),
  R2_PUBLIC_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  BILLING_SUCCESS_URL: z.string().url(),
  BILLING_CANCEL_URL: z.string().url(),
  BILLING_PORTAL_RETURN_URL: z.string().url(),
  RESEND_API_KEY: z.string(),
  RESEND_FROM: z.string(),
  SENTRY_DSN: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:\n', parsed.error.format())
  process.exit(1)
}

export const env = parsed.data
export const isProd = env.NODE_ENV === 'production'
export const aeatUrl = env.AEAT_ENV === 'prod'
  ? env.AEAT_VERIFACTU_URL_PROD
  : env.AEAT_VERIFACTU_URL_SANDBOX
