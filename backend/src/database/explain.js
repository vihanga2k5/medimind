import fs from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { Appointment } from '../models/index.js'

// Compares the doctor schedule lookup with and without the { doctorId, startAt } compound index.
const INDEX_NAME = 'doctorId_1_startAt_1'

function winningStages(plan) {
  const stages = []
  for (let node = plan; node; node = node.inputStage || node.inputStages?.[0]) stages.push(node.stage)
  return stages.join(' <- ')
}

function summarise(label, explain) {
  const stats = explain.executionStats
  return {
    label,
    winningPlan: winningStages(explain.queryPlanner.winningPlan.queryPlan || explain.queryPlanner.winningPlan),
    nReturned: stats.nReturned,
    totalKeysExamined: stats.totalKeysExamined,
    totalDocsExamined: stats.totalDocsExamined,
    executionTimeMillis: stats.executionTimeMillis,
  }
}

await connectDatabase()
const collection = mongoose.connection.db.collection('appointments')
const busiest = await collection.aggregate([{ $group: { _id: '$doctorId', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]).next()
if (!busiest) {
  console.error('No appointments found. Run "npm run seed" first.')
  process.exit(1)
}

const from = new Date(Date.now() - 60 * 86400000)
const to = new Date(Date.now() + 30 * 86400000)
const filter = { doctorId: busiest._id, startAt: { $gte: from, $lt: to } }
const run = () => collection.find(filter).sort({ startAt: 1 }).explain('executionStats')

if ((await collection.indexes()).some(index => index.name === INDEX_NAME)) await collection.dropIndex(INDEX_NAME)
const before = summarise('Without compound index', await run())
await collection.createIndex({ doctorId: 1, startAt: 1 }, { name: INDEX_NAME })
const after = summarise('With { doctorId: 1, startAt: 1 }', await run())
await Appointment.syncIndexes()

const report = {
  capturedAt: new Date().toISOString(),
  query: `db.appointments.find({ doctorId: ObjectId("${busiest._id}"), startAt: { $gte: ISODate("${from.toISOString()}"), $lt: ISODate("${to.toISOString()}") } }).sort({ startAt: 1 })`,
  totalDocumentsInCollection: await collection.countDocuments(),
  before,
  after,
}

console.table([before, after])
const outDir = path.resolve('evidence')
await fs.mkdir(outDir, { recursive: true })
const file = path.join(outDir, `explain-${report.capturedAt.slice(0, 10)}.json`)
await fs.writeFile(file, JSON.stringify(report, null, 2))
console.log(`Saved explain evidence to ${file}`)
await disconnectDatabase()
