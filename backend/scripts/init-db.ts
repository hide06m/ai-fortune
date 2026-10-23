/** DB の表を作る（何度実行しても安全）。使い方: DATABASE_URL=… npx tsx scripts/init-db.ts */
import { initializeDatabase, getPool } from '../src/db/client.js'

await initializeDatabase()
await getPool().end()
console.log('done')
