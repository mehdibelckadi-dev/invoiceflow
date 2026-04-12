import 'dotenv/config'
import postgres from 'postgres'
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const db = postgres(process.env.DATABASE_URL!, { max: 1 })

async function migrate() {
  // Tabla de control de migraciones
  await db`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  const appliedRows = await db`SELECT filename FROM _migrations ORDER BY id`
  const applied = new Set(appliedRows.map(r => r.filename))

  const migrationsDir = join(__dirname, 'migrations')
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort()

  let count = 0
  for (const file of files) {
    if (applied.has(file)) continue

    console.log(`Aplicando migración: ${file}`)
    const sql = await readFile(join(migrationsDir, file), 'utf-8')

    await db.begin(async (tx) => {
      await tx.unsafe(sql)
      await tx`INSERT INTO _migrations (filename) VALUES (${file})`
    })

    count++
  }

  console.log(`✅ ${count} migraciones aplicadas`)
  await db.end()
}

migrate().catch((err) => {
  console.error('❌ Error en migraciones:', err)
  process.exit(1)
})
