import fs from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db.js'

// Writes every collection as Extended JSON so ObjectIds and Dates survive the round trip.
// mongodump/mongorestore is the preferred tool when MongoDB Database Tools are installed.
const { EJSON } = mongoose.mongo.BSON

await connectDatabase()
const db = mongoose.connection.db
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const dir = path.resolve(process.argv[2] || path.join('backups', stamp))
await fs.mkdir(dir, { recursive: true })

const manifest = { database: db.databaseName, createdAt: new Date().toISOString(), collections: {} }
for (const { name } of await db.listCollections({ type: 'collection' }).toArray()) {
  const documents = await db.collection(name).find().toArray()
  await fs.writeFile(path.join(dir, `${name}.json`), EJSON.stringify(documents, { relaxed: false }))
  manifest.collections[name] = documents.length
}
await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.table(manifest.collections)
console.log(`Backup written to ${dir}`)
await disconnectDatabase()
