import type { FastifyReply, FastifyRequest } from 'fastify'
import { db } from '../../db.js'
import { redis } from '../../redis.js'
import { format } from 'date-fns'

export type Resource = 'invoice' | 'ocr' | 'ai_query' | 'email_inbound'

interface PlanData {
  slug: string
  invoiceLimit: number
  ocrLimit: number
  aiDailyLimit: number
  emailLimit: number
}

const FREE_PLAN: PlanData = {
  slug: 'free',
  invoiceLimit: 5,
  ocrLimit: 3,
  aiDailyLimit: 5,
  emailLimit: 10,
}

async function getPlanData(userId: string): Promise<PlanData> {
  const cacheKey = `plan:${userId}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  const [sub] = await db`
    SELECT p.slug, p.invoice_limit, p.ocr_limit, p.ai_daily_limit, p.email_limit
    FROM billing.subscriptions s
    JOIN billing.plans p ON s.plan_id = p.id
    WHERE s.user_id = ${userId} AND s.status IN ('active', 'trialing')
    LIMIT 1
  `

  const plan: PlanData = sub ? (sub as unknown as PlanData) : FREE_PLAN
  await redis.set(cacheKey, JSON.stringify(plan), 'EX', 300)
  return plan
}

export function checkPlanLimit(resource: Resource) {
  return async function planGuardHook(req: FastifyRequest, reply: FastifyReply) {
    const userId = (req.user as { sub: string }).sub
    const blocked = await checkPlanLimitProgrammatic(userId, resource)
    if (blocked) {
      return reply.status(403).send({
        code: 'PLAN_LIMIT_EXCEEDED',
        resource,
        upgradeUrl: '/billing/checkout?plan=pro',
      })
    }
  }
}

export async function checkPlanLimitProgrammatic(userId: string, resource: Resource): Promise<boolean> {
  const plan = await getPlanData(userId)
  const periodMonth = format(new Date(), 'yyyy-MM')

  const [usage] = await db`
    SELECT invoices_count, ocr_count, ai_queries_count, email_count
    FROM billing.usage_tracking
    WHERE user_id = ${userId} AND period_month = ${periodMonth}
  `
  const u = usage ?? { invoicesCount: 0, ocrCount: 0, aiQueriesCount: 0, emailCount: 0 }

  const limits: Record<Resource, { current: number; limit: number }> = {
    invoice:       { current: u.invoicesCount,  limit: plan.invoiceLimit },
    ocr:           { current: u.ocrCount,        limit: plan.ocrLimit },
    ai_query:      { current: u.aiQueriesCount, limit: plan.aiDailyLimit },
    email_inbound: { current: u.emailCount,      limit: plan.emailLimit },
  }

  const { current, limit } = limits[resource]
  return limit !== -1 && current >= limit
}

export async function incrementUsage(userId: string, resource: Resource) {
  const col = {
    invoice:       'invoices_count',
    ocr:           'ocr_count',
    ai_query:      'ai_queries_count',
    email_inbound: 'email_count',
  }[resource]

  const periodMonth = format(new Date(), 'yyyy-MM')
  await db`
    INSERT INTO billing.usage_tracking (user_id, period_month, ${db.unsafe(col)})
    VALUES (${userId}, ${periodMonth}, 1)
    ON CONFLICT (user_id, period_month)
    DO UPDATE SET ${db.unsafe(col)} = billing.usage_tracking.${db.unsafe(col)} + 1,
                  updated_at = NOW()
  `
}
