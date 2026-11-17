import fs from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { applySchemaValidators, syncAllIndexes } from './setup.js'

const { EJSON } = mongoose.mongo.BSON

const source = process.argv[2]
if (!source || !process.argv.includes('--drop')) {
  console.error('Usage: npm run restore -- <backup-folder> --drop   (the current database is dropped before restoring)')
  process.exit(1)
}

const dir = path.resolve(source)
const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'))
await connectDatabase()
const db = mongoose.connection.db
await db.dropDatabase()
await applySchemaValidators()

const results = []
for (const [name, expected] of Object.entries(manifest.collections)) {
  const documents = EJSON.parse(await fs.readFile(path.join(dir, `${name}.json`), 'utf8'), { relaxed: false })
  if (documents.length) await db.collection(name).insertMany(documents, { ordered: false })
  const restored = await db.collection(name).countDocuments()
  results.push({ collection: name, expected, restored, match: expected === restored })
}
await syncAllIndexes()

console.table(results)
const sample = await db.collection('appointments').findOne({}, { sort: { startAt: -1 } })
if (sample) console.log('Sample restored appointment:', { id: String(sample._id), startAt: sample.startAt, status: sample.status })
await disconnectDatabase()
process.exit(results.every(row => row.match) ? 0 : 1)
