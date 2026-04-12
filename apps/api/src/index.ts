import 'dotenv/config'
import { buildApp } from './app.js'
import { env } from './config.js'

const app = await buildApp()

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`🚀 API corriendo en http://0.0.0.0:${env.PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
