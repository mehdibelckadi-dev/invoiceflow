import postgres from 'postgres'
import { env } from './config.js'

export const db = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  transform: postgres.camel,  // snake_case DB → camelCase JS
})
