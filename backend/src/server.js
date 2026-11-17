import { createApp } from './app.js'
import { connectDatabase, disconnectDatabase, supportsTransactions } from './config/db.js'
import { env } from './config/env.js'
import { applySchemaValidators } from './database/setup.js'

await connectDatabase()
await applySchemaValidators()
console.log(`[db] connected (${supportsTransactions() ? 'replica set, transactions enabled' : 'standalone, using unique-index booking fallback'})`)

const server = createApp().listen(env.port, () => {
  console.log(`[api] MediMind API listening on http://localhost:${env.port}/api`)
})

async function shutdown() {
  server.close()
  await disconnectDatabase()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
