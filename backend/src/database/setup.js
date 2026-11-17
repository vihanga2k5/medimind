import { pathToFileURL } from 'node:url'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import * as models from '../models/index.js'
import { collectionValidators } from './validators.js'

export async function applySchemaValidators() {
  const db = mongoose.connection.db
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name))
  for (const [name, validator] of Object.entries(collectionValidators)) {
    const options = { validator, validationLevel: 'strict', validationAction: 'error' }
    if (!existing.has(name)) {
      try {
        await db.createCollection(name, options)
        continue
      } catch (error) {
        if (error.code !== 48) throw error
      }
    }
    await db.command({ collMod: name, ...options })
  }
}

export async function syncAllIndexes() {
  const result = {}
  for (const model of Object.values(models)) {
    await model.syncIndexes()
    result[model.collection.collectionName] = (await model.collection.indexes()).map(index => ({ name: index.name, key: index.key, unique: Boolean(index.unique) }))
  }
  return result
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await connectDatabase()
  await applySchemaValidators()
  const indexes = await syncAllIndexes()
  console.log('Validators applied to:', Object.keys(collectionValidators).join(', '))
  for (const [collection, list] of Object.entries(indexes)) {
    console.log(`${collection}: ${list.map(index => `${index.name}${index.unique ? ' (unique)' : ''}`).join(', ')}`)
  }
  await disconnectDatabase()
}
