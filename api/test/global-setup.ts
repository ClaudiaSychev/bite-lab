import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'

// Fresh SQLite file per run, migrated to the current schema.
export function setup() {
  rmSync('test.db', { force: true })
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'ignore',
  })
}
