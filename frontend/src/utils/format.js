// Appointment times are shown in clinic time so every user sees the same schedule.
export const CLINIC_TIME_ZONE = 'Asia/Colombo'

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: CLINIC_TIME_ZONE })
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: CLINIC_TIME_ZONE })
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: CLINIC_TIME_ZONE })
const longDayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: CLINIC_TIME_ZONE })
const keyFormat = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: CLINIC_TIME_ZONE })
const weekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: CLINIC_TIME_ZONE })
const dayNumberFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: CLINIC_TIME_ZONE })
const hourFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: CLINIC_TIME_ZONE })

export const formatDate = value => (value ? dateFormat.format(new Date(value)) : '—')
export const formatTime = value => (value ? timeFormat.format(new Date(value)) : '—')
export const formatDay = value => dayFormat.format(new Date(value))
export const formatLongDay = value => longDayFormat.format(new Date(value))
export const formatDateTime = value => (value ? `${formatDay(value)}, ${formatTime(value)}` : '—')
export const formatWeekday = value => weekdayFormat.format(new Date(value))
export const formatDayNumber = value => dayNumberFormat.format(new Date(value))
export const dateKey = value => keyFormat.format(new Date(value))
export const clinicHour = (value = new Date()) => Number(hourFormat.format(new Date(value)))

// Midnight in clinic time for a YYYY-MM-DD key, plus a number of days.
export function clinicDayStart(key = dateKey(new Date()), addDays = 0) {
  const start = new Date(`${key}T00:00:00+05:30`)
  return new Date(start.getTime() + addDays * 86400000)
}

export function greeting() {
  const hour = clinicHour()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

export const firstName = name => (name || '').replace(/^Dr\.?\s+/i, '').split(' ')[0]

export function statusLabel(status) {
  const text = String(status ?? '').replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const consultationLabel = type => (type === 'online' ? 'Video consultation' : 'In-person')

export function formatSize(bytes = 0) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatDate(value)
}

export const formatNumber = value => Number(value || 0).toLocaleString('en-US')

export function formatChange(percent, suffix = 'vs last month') {
  if (percent === null || percent === undefined) return ''
  return `${percent > 0 ? '+' : ''}${percent}% ${suffix}`
}
