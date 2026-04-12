import { z } from 'zod'
import { isValidNif } from '@lefse/shared'

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(255),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totp_code: z.string().length(6).optional(),
})

export const RefreshSchema = z.object({
  refresh_token: z.string(),
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const ResetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(100),
})

export const VerifyEmailSchema = z.object({
  token: z.string(),
})

export type RegisterDto = z.infer<typeof RegisterSchema>
export type LoginDto = z.infer<typeof LoginSchema>
