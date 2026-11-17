
import mongoose from 'mongoose'
import { env } from './env.js'

// Manage indexes explicitly through the database setup script.
mongoose.set('autoIndex', false)
mongoose.set('strictQuery', true)

mongoose.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id)
    delete ret._id
    delete ret.passwordHash
    return ret
  },
})

let transactionsSupported = false

export async function connectDatabase(uri = env.mongoUri) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
  })

  const hello = await mongoose.connection.db.admin().command({ hello: 1 })

  transactionsSupported = Boolean(hello.setName || hello.msg === 'isdbgrid')

  return mongoose.connection
}

export function supportsTransactions() {
  return transactionsSupported
}

export async function runAtomic(work) {
  if (!transactionsSupported) return work(null)

  const session = await mongoose.startSession()

  try {
    let result

    await session.withTransaction(async () => {
      result = await work(session)
    })

    return result
  } finally {
    await session.endSession()
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}
