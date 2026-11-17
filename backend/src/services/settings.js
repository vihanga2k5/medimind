import { DEFAULT_SETTINGS } from '../models/Setting.js'
import { Setting } from '../models/index.js'

export async function getSettings() {
  const rows = await Setting.find({ key: { $in: Object.keys(DEFAULT_SETTINGS) } }).lean()
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map(row => [row.key, row.value])) }
}

export async function updateSettings(changes, userId) {
  await Promise.all(Object.entries(changes).map(([key, value]) => Setting.updateOne({ key }, { $set: { value, updatedBy: userId } }, { upsert: true })))
  return getSettings()
}
