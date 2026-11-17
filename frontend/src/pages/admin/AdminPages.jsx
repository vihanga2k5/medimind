import { useDeferredValue, useState } from 'react'
import { Activity, CalendarDays, CheckCircle2, Download, FileBarChart, Plus, Search, ShieldCheck, Stethoscope, Users, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import { EmptyState, ErrorMessage, Pager } from '../../components/Feedback'
import { useApi } from '../../hooks/useApi'
import { analyticsApi, appointmentApi, doctorApi, patientApi, settingsApi } from '../../services/api'
import { clinicDayStart, dateKey, formatChange, formatDay, formatLongDay, formatNumber, formatTime, statusLabel, timeAgo } from '../../utils/format'

const SPECIALTIES = ['Cardiologist', 'General Physician', 'Dermatologist', 'Neurologist', 'Pediatrician', 'Orthopedic Surgeon', 'Psychiatrist', 'ENT Specialist', 'Endocrinologist', 'Gynecologist']

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function BarChart({ rows, label, value }) {
  const max = Math.max(1, ...rows.map(value))
  return <div className="bar-chart">{rows.map(row => <div key={label(row)} title={`${label(row)}: ${formatNumber(value(row))}`}><i style={{ height: `${Math.max(3, (value(row) / max) * 100)}%` }}></i><span>{label(row)}</span></div>)}</div>
}

export function AdminDashboard() {
  const [months, setMonths] = useState(6)
  const { data: o, error, loading } = useApi(analyticsApi.overviewPath({ months }))
  const metrics = o ? [
    { label: 'Registered patients', value: formatNumber(o.totals.registeredPatients), change: formatChange(o.changes.patientGrowthPercent), tone: 'teal', icon: Users },
    { label: 'Active doctors', value: formatNumber(o.totals.activeDoctors), change: `+${o.changes.newDoctorsThisMonth} this month`, tone: 'blue', icon: Stethoscope },
    { label: 'Appointments this month', value: formatNumber(o.totals.appointmentsThisMonth), change: formatChange(o.changes.appointmentsPercent), tone: 'coral', icon: CalendarDays },
    { label: 'AI consultations', value: formatNumber(o.totals.aiConversations), change: formatChange(o.changes.aiConversationsPercent), tone: 'purple', icon: Activity },
  ] : []

  function exportReport() {
    downloadCsv(`medimind-report-${dateKey(new Date())}.csv`, [
      ['Metric', 'Value', 'Change'], ...metrics.map(metric => [metric.label, metric.value, metric.change]),
      ['Attendance rate', o.attendanceRate === null ? 'n/a' : `${o.attendanceRate}%`, ''], [],
      ['Month', 'Appointments'], ...o.monthlyAppointments.map(row => [`${row.label} ${row.year}`, row.total]),
    ])
  }

  return <><PageHeader eyebrow="PLATFORM OVERVIEW" title="MediMind at a glance." description="Monitor the health of your platform and the care it enables." actions={<button className="outline-button" onClick={exportReport} disabled={!o}><Download size={16} /> Export report</button>} /><ErrorMessage>{error}</ErrorMessage><section className="stat-grid">{metrics.map(metric => <StatCard key={metric.label} {...metric} />)}</section>{!o && <EmptyState loading={loading} />}{o && <><section className="dashboard-grid admin-grid"><article className="card analytics-card"><div className="section-title"><div><p>APPOINTMENT ACTIVITY</p><h2>Monthly consultations</h2></div><select value={months} onChange={e => setMonths(Number(e.target.value))}><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></div><BarChart rows={o.monthlyAppointments} label={row => row.label} value={row => row.total} /></article><article className="card activity-card"><div className="section-title"><div><p>PLATFORM ACTIVITY</p><h2>Recent updates</h2></div></div>{o.recentActivity.map((item, index) => <div className="activity-item" key={`${item.type}-${item.at}-${index}`}><span className={`activity-icon type-${item.type}`}>{index + 1}</span><div><b>{item.title}</b><small>{timeAgo(item.at)}</small></div></div>)}{!o.recentActivity.length && <EmptyState>No recent activity.</EmptyState>}</article></section><section className="card admin-action"><div><ShieldCheck size={23} /><h2>Review doctor verification requests</h2><p>{o.totals.pendingDoctorVerifications ? `${o.totals.pendingDoctorVerifications} healthcare professional${o.totals.pendingDoctorVerifications === 1 ? ' is' : 's are'} awaiting document review.` : 'There are no pending verification requests.'}</p></div><Link className="primary-button" to="/admin/doctors?status=pending">Review requests</Link></section></>}</> }

export function AdminDoctorsPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [inviting, setInviting] = useState(false)
  const status = params.get('status') || ''
  const search = useDeferredValue(query.trim())
  const list = useApi(doctorApi.path({ q: search, status, page, limit: 20, sort: 'fullName' }))
  const shown = list.data || []

  async function verify(doctor, verificationStatus) {
    if (!verificationStatus) return
    setError('')
    try {
      await doctorApi.setVerification(doctor.id, verificationStatus)
      setNotice(`${doctor.name} is now ${verificationStatus}.`)
      list.reload()
    } catch (err) { setError(err.message) }
  }

  return <><PageHeader eyebrow="PEOPLE MANAGEMENT" title="Doctor management" description="Verify healthcare professionals and manage directory access." actions={<button className="primary-button" onClick={() => setInviting(!inviting)}><Plus size={17} /> Invite doctor</button>} />{inviting && <InviteDoctor onClose={() => setInviting(false)} onCreated={doctor => { setNotice(`${doctor.name} was added to the directory.`); setInviting(false); list.reload() }} />}<div className="directory-tools"><div className="search-box"><Search size={19} /><input value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="Search doctors" /></div><select value={status} onChange={e => { setParams(e.target.value ? { status: e.target.value } : {}); setPage(1) }} aria-label="Verification status"><option value="">All statuses</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></div>{notice && <p className="save-message"><CheckCircle2 size={16} /> {notice}</p>}<ErrorMessage>{error || list.error}</ErrorMessage><section className="card record-table admin-table"><div className="record-head"><span>Doctor</span><span>Specialty</span><span>Facility</span><span>Status</span><span></span></div>{shown.map(doctor => <div className="record-item" key={doctor.id}><span className="record-name"><span className={`doctor-avatar ${doctor.color || 'teal'}`}>{doctor.initials}</span><span><b>{doctor.name}</b><small>{doctor.reviews ?? 0} patient reviews</small></span></span><span>{doctor.specialty}</span><span>{doctor.hospital}</span><StatusBadge>{doctor.verificationStatus}</StatusBadge><select value="" onChange={e => verify(doctor, e.target.value)} aria-label={`Change verification for ${doctor.name}`}><option value="">Change…</option>{['verified', 'pending', 'rejected'].filter(item => item !== doctor.verificationStatus).map(item => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></div>)}{!shown.length && <EmptyState loading={list.loading}>No doctors found.</EmptyState>}</section><Pager pagination={list.body?.pagination} onChange={setPage} /></>
}

function InviteDoctor({ onClose, onCreated }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const { data } = await doctorApi.create({
        fullName: form.get('fullName'), email: form.get('email'), password: form.get('password'), specialty: form.get('specialty'), hospital: form.get('hospital'), city: form.get('city'),
        consultationFee: Number(form.get('consultationFee') || 0), verificationStatus: form.get('verificationStatus'),
        availability: [1, 2, 3, 4, 5].map(dayOfWeek => ({ dayOfWeek, startTime: '09:00', endTime: '17:00', slotMinutes: 30 })),
      })
      onCreated(data)
    } catch (err) {
      setError(err.details?.[0]?.message || err.message)
      setBusy(false)
    }
  }
  return <form className="card details-form" onSubmit={submit}><div className="section-title"><div><p>NEW DOCTOR</p><h2>Create a doctor account</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><div className="form-grid"><label>Full name<input name="fullName" placeholder="Dr. Full Name" minLength="2" required /></label><label>Email address<input name="email" type="email" required /></label><label>Temporary password<input name="password" type="text" minLength="8" pattern="(?=.*[A-Za-z])(?=.*\d).{8,}" title="At least 8 characters with a letter and a number" required /></label><label>Specialty<select name="specialty" defaultValue={SPECIALTIES[0]}>{SPECIALTIES.map(item => <option key={item}>{item}</option>)}</select></label><label>Hospital<input name="hospital" /></label><label>City<input name="city" defaultValue="Colombo" /></label><label>Consultation fee (Rs.)<input name="consultationFee" type="number" min="0" defaultValue="2500" /></label><label>Verification<select name="verificationStatus" defaultValue="verified"><option value="verified">Verified</option><option value="pending">Pending review</option></select></label></div><p>New doctors start with weekday hours of 9:00 AM – 5:00 PM, which they can change from their profile.</p><ErrorMessage>{error}</ErrorMessage><button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create doctor account'}</button></form>
}

export function AdminAppointmentsPage() {
  const [view, setView] = useState('Today')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [ranges] = useState(() => {
    const key = dateKey(new Date())
    return { Today: { from: clinicDayStart(key).toISOString(), to: clinicDayStart(key, 1).toISOString() }, Upcoming: { scope: 'upcoming' }, All: { sort: '-startAt' } }
  })
  const overview = useApi(analyticsApi.overviewPath())
  const list = useApi(appointmentApi.path({ ...ranges[view], status, page, limit: 20 }))
  const o = overview.data
  const rows = list.data || []
  return <><PageHeader eyebrow="PLATFORM OPERATIONS" title="Appointment management" description="Track appointments across the MediMind care network." /><section className="card operations-summary"><div><b>{o ? formatNumber(o.totals.appointmentsThisMonth) : '–'}</b><span>Appointments this month</span></div><div><b>{o?.attendanceRate != null ? `${o.attendanceRate}%` : '–'}</b><span>Attendance rate</span></div><div><b>{o ? formatNumber(o.totals.appointmentsToday) : '–'}</b><span>Today’s appointments</span></div></section><div className="schedule-filter">{Object.keys(ranges).map(name => <button key={name} className={view === name ? 'active' : ''} onClick={() => { setView(name); setPage(1) }}>{name}</button>)}<select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} aria-label="Filter by status"><option value="">All statuses</option>{['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'].map(item => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></div><ErrorMessage>{overview.error || list.error}</ErrorMessage><section className="card operations-list"><h2>{view === 'Today' ? `Today’s schedule · ${formatLongDay(ranges.Today.from)}` : `${view} appointments`}</h2>{rows.map(item => <div key={item.id}><span>{view === 'Today' ? formatTime(item.startAt) : `${formatDay(item.startAt)} ${formatTime(item.startAt)}`} · {item.doctor?.name} · {item.patient?.name}</span><StatusBadge>{item.status}</StatusBadge></div>)}{!rows.length && <EmptyState loading={list.loading}>No appointments found.</EmptyState>}</section><Pager pagination={list.body?.pagination} onChange={setPage} /></>
}

export function AdminPatientsPage() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const search = useDeferredValue(query.trim())
  const list = useApi(patientApi.path({ q: search, page, limit: 20, sort: '-createdAt' }))
  const rows = list.data || []
  return <><PageHeader eyebrow="PEOPLE MANAGEMENT" title="Patient administration" description="Monitor patient registration and account activity." /><div className="directory-tools"><div className="search-box"><Search size={19} /><input value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="Search patients by name" /></div></div><ErrorMessage>{list.error}</ErrorMessage><section className="card operations-list"><h2>{search ? 'Matching patients' : 'Recent patient registrations'} · {formatNumber(list.body?.pagination?.total)}</h2>{rows.map(patient => <div key={patient.id}><span><Users size={17} /> {patient.name} · joined {timeAgo(patient.createdAt).toLowerCase()}</span><small>{[patient.age != null && `${patient.age} years`, patient.address.city].filter(Boolean).join(' · ')}</small></div>)}{!rows.length && <EmptyState loading={list.loading}>No patients found.</EmptyState>}</section><Pager pagination={list.body?.pagination} onChange={setPage} /></>
}

export function AnalyticsPage() {
  const overview = useApi(analyticsApi.overviewPath())
  const byDoctor = useApi('/analytics/appointments-by-doctor?limit=10')
  const o = overview.data

  function exportCsv() {
    downloadCsv(`medimind-analytics-${dateKey(new Date())}.csv`, [
      ['Specialty', 'Appointments', 'Completed', 'Completion rate %', 'Doctors'], ...o.appointmentsBySpecialty.map(row => [row.specialty, row.totalAppointments, row.completed, row.completionRate, row.doctorCount]), [],
      ['Doctor', 'Specialty', 'Appointments', 'Completed', 'Cancelled', 'No-shows'], ...(byDoctor.data || []).map(row => [row.name, row.specialty, row.totalAppointments, row.completed, row.cancelled, row.noShows]), [],
      ['Weekday', 'Appointments'], ...o.weekdayActivity.map(row => [row.day, row.total]),
    ])
  }

  return <><PageHeader eyebrow="PLATFORM INSIGHTS" title="Analytics and reporting" description="Use operational trends to understand platform activity." actions={<button className="outline-button" onClick={exportCsv} disabled={!o}><FileBarChart size={16} /> Download CSV</button>} /><ErrorMessage>{overview.error || byDoctor.error}</ErrorMessage>{!o ? <EmptyState loading={overview.loading} /> : <><section className="stat-grid"><StatCard icon={Users} label="Patient growth" value={formatChange(o.changes.patientGrowthPercent, '') || '0%'} change="Compared with last month" /><StatCard icon={CalendarDays} label="Appointment completion" value={o.attendanceRate != null ? `${o.attendanceRate}%` : '–'} change="Completed vs. missed visits" tone="blue" /><StatCard icon={Activity} label="AI engagement" value={`${o.aiEngagementPercent}%`} change="Of registered patients" tone="purple" /></section><section className="card analytics-card detailed-chart"><div className="section-title"><div><p>USAGE TREND</p><h2>Weekly activity</h2></div></div><BarChart rows={o.weekdayActivity} label={row => row.day} value={row => row.total} /></section><section className="card record-table admin-table"><div className="record-head"><span>Specialty</span><span>Appointments</span><span>Completed</span><span>Completion</span><span>Doctors</span></div>{o.appointmentsBySpecialty.map(row => <div className="record-item" key={row.specialty}><span><b>{row.specialty}</b></span><span>{formatNumber(row.totalAppointments)}</span><span>{formatNumber(row.completed)}</span><span>{row.completionRate}%</span><span>{row.doctorCount}</span></div>)}</section><section className="card record-table admin-table"><div className="record-head"><span>Busiest doctors</span><span>Appointments</span><span>Completed</span><span>Cancelled</span><span>No-shows</span></div>{(byDoctor.data || []).map(row => <div className="record-item" key={row.doctorId}><span><b>{row.name}</b><small> · {row.specialty}</small></span><span>{formatNumber(row.totalAppointments)}</span><span>{formatNumber(row.completed)}</span><span>{formatNumber(row.cancelled)}</span><span>{formatNumber(row.noShows)}</span></div>)}</section></>}</>
}

export function AdminSettingsPage() {
  const { data: settings, error, reload } = useApi(settingsApi.path)
  const [showPolicy, setShowPolicy] = useState(false)
  const [saved, setSaved] = useState('')
  const [saveError, setSaveError] = useState('')

  async function save(changes, message) {
    setSaved('')
    setSaveError('')
    try { await settingsApi.update(changes); setSaved(message); reload() } catch (err) { setSaveError(err.details?.[0]?.message || err.message) }
  }

  function saveBooking(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    save({ maxBookingDaysAhead: Number(form.get('maxBookingDaysAhead')), patientCancellationHours: Number(form.get('patientCancellationHours')) }, 'Booking rules were updated.')
  }

  return <><PageHeader eyebrow="PLATFORM SETTINGS" title="Administration settings" description="Configure visible platform preferences and policies." />{saved && <p className="save-message"><CheckCircle2 size={16} /> {saved}</p>}<ErrorMessage>{error || saveError}</ErrorMessage>{!settings ? <EmptyState loading={!error} /> : <section className="card settings-list"><div><span><ShieldCheck size={19} /></span><section><h2>Privacy and data controls</h2><p>Patient information must only be accessed by authorised care providers.</p>{showPolicy && <p>Patients see only their own data. Doctors can open records only for patients they have an appointment with. Administrators manage accounts and analytics but cannot read clinical notes or documents.</p>}</section><button className="outline-button" onClick={() => setShowPolicy(!showPolicy)}>{showPolicy ? 'Hide policy' : 'Review policy'}</button></div><div><span><Stethoscope size={19} /></span><section><h2>Doctor verification workflow</h2><p>Require credential review before professionals appear in the directory.</p></section><label className="switch"><input type="checkbox" checked={settings.requireDoctorVerification} onChange={e => save({ requireDoctorVerification: e.target.checked }, e.target.checked ? 'Only verified doctors are now listed.' : 'All doctors are now listed in the directory.')} /><i></i></label></div><div><span><CalendarDays size={19} /></span><section><h2>Booking rules</h2><form key={`${settings.maxBookingDaysAhead}-${settings.patientCancellationHours}`} className="form-grid" onSubmit={saveBooking}><label>Book up to (days ahead)<input name="maxBookingDaysAhead" type="number" min="1" max="365" defaultValue={settings.maxBookingDaysAhead} required /></label><label>Online cancellation notice (hours)<input name="patientCancellationHours" type="number" min="0" max="72" defaultValue={settings.patientCancellationHours} required /></label><button className="outline-button">Save booking rules</button></form></section></div></section>}</>
}
