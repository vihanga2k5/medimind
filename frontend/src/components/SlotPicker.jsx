import { useState } from 'react'
import { EmptyState, ErrorMessage } from './Feedback'
import { useApi } from '../hooks/useApi'
import { doctorApi } from '../services/api'
import { clinicDayStart, dateKey, formatDayNumber, formatTime, formatWeekday } from '../utils/format'

const DAYS_SHOWN = 8

export default function SlotPicker({ doctorId, selected, onSelect, refresh = 0, current }) {
  const [days] = useState(() => Array.from({ length: DAYS_SHOWN }, (_, index) => dateKey(clinicDayStart(undefined, index))))
  const [day, setDay] = useState(days[0])
  const slots = useApi(doctorApi.slotsPath(doctorId, day), refresh)
  const open = (slots.data || []).filter(item => item.status !== 'past')
  return <>
    <div className="date-row">{days.map((key, index) => <button type="button" key={key} className={day === key ? 'selected' : ''} onClick={() => { setDay(key); onSelect(null) }}>{index === 0 ? 'Today' : formatWeekday(clinicDayStart(key))}<br /><b>{formatDayNumber(clinicDayStart(key))}</b></button>)}</div>
    <ErrorMessage>{slots.error}</ErrorMessage>
    {slots.loading && !slots.data ? <EmptyState loading /> : open.length ? <div className="time-slots">{open.map(item => {
      const isCurrent = current && new Date(current).getTime() === new Date(item.startAt).getTime()
      return <button type="button" key={item.startAt} disabled={!item.available} className={selected === item.startAt ? 'selected' : ''} onClick={() => onSelect(item.startAt)} title={isCurrent ? 'Your current time' : item.available ? 'Available' : 'Already booked'}>{formatTime(item.startAt)}{isCurrent ? ' ✓' : ''}</button>
    })}</div> : <EmptyState>No open consultation times on this day.</EmptyState>}
  </>
}
