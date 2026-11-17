import { env } from '../config/env.js'

const MINUTE = 60 * 1000
const offset = () => env.clinicUtcOffsetMinutes * MINUTE

// Doctor availability is stored as clinic local time; appointments are stored as UTC dates.
export function localDateString(date) {
  return new Date(date.getTime() + offset()).toISOString().slice(0, 10)
}

export function localDayOfWeek(dateString) {
  return new Date(`${dateString}T00:00:00Z`).getUTCDay()
}

export function localTimeToDate(dateString, time) {
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(Date.parse(`${dateString}T00:00:00Z`) + (hours * 60 + minutes) * MINUTE - offset())
}

export function localTimeString(date) {
  return new Date(date.getTime() + offset()).toISOString().slice(11, 16)
}

export function addDays(dateString, days) {
  return new Date(Date.parse(`${dateString}T00:00:00Z`) + days * 24 * 60 * MINUTE).toISOString().slice(0, 10)
}

export function slotsForDate(doctor, dateString) {
  const day = localDayOfWeek(dateString)
  const slots = []
  for (const block of doctor.availability || []) {
    if (block.dayOfWeek !== day) continue
    const step = (block.slotMinutes || 30) * MINUTE
    const end = localTimeToDate(dateString, block.endTime).getTime()
    for (let start = localTimeToDate(dateString, block.startTime).getTime(); start + step <= end; start += step) {
      slots.push({ startAt: new Date(start), endAt: new Date(start + step) })
    }
  }
  return slots.sort((a, b) => a.startAt - b.startAt)
}

export function findSlot(doctor, startAt) {
  return slotsForDate(doctor, localDateString(startAt)).find(slot => slot.startAt.getTime() === startAt.getTime()) || null
}
