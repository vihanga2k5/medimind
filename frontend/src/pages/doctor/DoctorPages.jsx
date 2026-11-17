import { useDeferredValue, useState } from 'react'
import { CalendarDays, CheckCircle2, ClipboardList, Download, FileText, HeartPulse, Plus, Search, Stethoscope, Trash2, Users, Video, X } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import { EmptyState, ErrorMessage, Pager } from '../../components/Feedback'
import { useAuth } from '../../context/AuthContext'
import { useApi } from '../../hooks/useApi'
import { analyticsApi, appointmentApi, doctorApi, documentApi, recordApi } from '../../services/api'
import { clinicDayStart, consultationLabel, dateKey, firstName, formatDate, formatDay, formatLongDay, formatSize, formatTime, greeting, statusLabel } from '../../utils/format'

// Mirrors the status rules enforced by the API.
const NEXT_STATUSES = { pending: ['confirmed', 'cancelled'], confirmed: ['checked_in', 'completed', 'no_show', 'cancelled'], checked_in: ['completed', 'cancelled'] }
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ACTIVE = 'pending,confirmed,checked_in'

function PatientAvatar({ initials }) { return <span className="patient-avatar">{initials}</span> }

function AppointmentTable({ rows, loading, compact = false, onChanged, showDate = false }) {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  async function changeStatus(item, status) {
    if (!status) return
    if (status === 'cancelled' && !window.confirm(`Cancel ${item.patient?.name}'s appointment?`)) return
    setError('')
    try { await appointmentApi.setStatus(item.id, status, status === 'cancelled' ? 'Cancelled by doctor' : undefined); onChanged?.() } catch (err) { setError(err.message) }
  }
  return <div className="doctor-appointment-list">{rows.map(item => <article key={item.id} className="doctor-appointment-row"><PatientAvatar initials={item.patient?.initials} /><div className="patient-appointment"><h3>{item.patient?.name} {item.patient?.age != null && <span>· {item.patient.age} years</span>}</h3><p>{item.reason}</p></div><div className="appointment-time"><b>{showDate ? `${formatDay(item.startAt)} · ` : ''}{formatTime(item.startAt)}</b><span>{item.consultationType === 'online' ? <Video size={14} /> : <Stethoscope size={14} />}{consultationLabel(item.consultationType)}</span></div><StatusBadge>{item.status}</StatusBadge>{!compact && NEXT_STATUSES[item.status] ? <select value="" onChange={e => changeStatus(item, e.target.value)} aria-label={`Update status for ${item.patient?.name}`}><option value="">Update status</option>{NEXT_STATUSES[item.status].map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select> : null}<button className="outline-button" onClick={() => navigate(`/doctor/consultations?appointment=${item.id}`)}>Open</button></article>)}{!rows.length && <EmptyState loading={loading}>No appointments in this period.</EmptyState>}<ErrorMessage>{error}</ErrorMessage></div>
}

function todayRange(offset = 0, days = 1) {
  const key = dateKey(new Date())
  return { from: clinicDayStart(key, offset).toISOString(), to: clinicDayStart(key, offset + days).toISOString() }
}

export function DoctorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [range] = useState(() => todayRange())
  const stats = useApi(analyticsApi.mePath)
  const today = useApi(appointmentApi.path({ ...range, status: `${ACTIVE},completed`, limit: 20 }))
  const upcoming = useApi(appointmentApi.path({ scope: 'upcoming', status: ACTIVE, limit: 1 }))
  const next = upcoming.data?.[0]
  const s = stats.data
  return <><PageHeader eyebrow="DOCTOR OVERVIEW" title={`${greeting()}, Dr. ${firstName(user.name)}.`} description={s ? `You have ${s.appointmentsToday} scheduled consultation${s.appointmentsToday === 1 ? '' : 's'} today.` : 'Loading your schedule…'} actions={<Link className="primary-button" to="/doctor/profile"><Plus size={17} /> Add availability</Link>} /><ErrorMessage>{stats.error || today.error}</ErrorMessage><section className="stat-grid"><StatCard icon={CalendarDays} label="Today’s appointments" value={s?.appointmentsToday ?? '–'} change={`${s?.onlineToday ?? 0} video consultations`} /><StatCard icon={Users} label="Active patients" value={s?.activePatients ?? '–'} change={`+${s?.newPatientsThisMonth ?? 0} this month`} tone="blue" /><StatCard icon={ClipboardList} label="Pending notes" value={s?.pendingNotes ?? '–'} change="Complete after visits" tone="coral" /><StatCard icon={HeartPulse} label="Upcoming appointments" value={s?.upcomingAppointments ?? '–'} change="Across all future dates" tone="purple" /></section><section className="dashboard-grid doctor-dashboard-grid"><article className="card"><div className="section-title"><div><p>TODAY · {formatLongDay(range.from).toUpperCase()}</p><h2>Your schedule</h2></div><Link className="text-link" to="/doctor/appointments">View calendar</Link></div><AppointmentTable rows={today.data || []} loading={today.loading} compact /></article><article className="card doctor-today"><p>YOUR NEXT CONSULTATION</p>{next ? <><div className="next-patient"><PatientAvatar initials={next.patient?.initials} /><div><h2>{next.patient?.name}</h2><span>{next.patient?.age != null ? `${next.patient.age} years · ` : ''}{next.reason}</span></div></div><div className="consult-time"><span>{formatDay(next.startAt)}, {formatTime(next.startAt)}</span><span>{consultationLabel(next.consultationType)}</span></div><button className="primary-button full-width" onClick={() => navigate(`/doctor/consultations?appointment=${next.id}`)}><Video size={17} /> Start consultation</button><button className="outline-button full-width" onClick={() => navigate(`/doctor/patients?patient=${next.patientId}`)}>Review patient record</button></> : <EmptyState loading={upcoming.loading}>No upcoming consultations.</EmptyState>}</article></section><section className="card clinic-note"><FileText size={21} /><div><h2>Clinical documentation reminder</h2><p>{s?.pendingNotes ? `${s.pendingNotes} completed visit${s.pendingNotes === 1 ? ' is' : 's are'} still missing consultation notes.` : 'Complete your consultation notes shortly after each appointment to keep the patient record current.'}</p></div><Link className="outline-button" to="/doctor/consultations">View pending notes</Link></section></> }

const FILTERS = { Today: [0, 1], Tomorrow: [1, 1], 'This week': [0, 7] }

export function DoctorAppointmentsPage() {
  const [filter, setFilter] = useState('Today')
  const [page, setPage] = useState(1)
  const [ranges] = useState(() => Object.fromEntries(Object.entries(FILTERS).map(([name, [offset, days]]) => [name, todayRange(offset, days)])))
  const range = ranges[filter]
  const list = useApi(appointmentApi.path({ ...range, page, limit: 20 }))
  const label = filter === 'This week' ? `${formatDate(range.from)} – ${formatDate(new Date(new Date(range.to).getTime() - 1))}` : formatLongDay(range.from)
  return <><PageHeader eyebrow="CLINIC SCHEDULE" title="My appointments" description="View and manage your assigned consultations." /><div className="schedule-filter">{Object.keys(FILTERS).map(name => <button key={name} className={filter === name ? 'active' : ''} onClick={() => { setFilter(name); setPage(1) }}>{name}</button>)}<span>{label}</span></div><ErrorMessage>{list.error}</ErrorMessage><section className="card appointment-board"><AppointmentTable rows={list.data || []} loading={list.loading} onChanged={list.reload} showDate={filter === 'This week'} /></section><Pager pagination={list.body?.pagination} onChange={setPage} /></>
}

export function PatientsPage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const query = useDeferredValue(search.trim())
  const list = useApi(`/patients?${new URLSearchParams({ page, limit: 12, ...(query ? { q: query } : {}) })}`)
  const selectedId = params.get('patient')
  const patients = list.data || []
  return <><PageHeader eyebrow="MY PATIENTS" title="Patient directory" description="Access information only for patients assigned to your care." /><div className="directory-tools"><div className="search-box"><Search size={19} /><input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search your patients" /></div></div><ErrorMessage>{list.error}</ErrorMessage>{selectedId && <PatientRecord patientId={selectedId} onClose={() => setParams({})} />}<section className="patient-grid">{patients.map(patient => <article className="card patient-card" key={patient.id}><PatientAvatar initials={patient.initials} /><div><h2>{patient.name}</h2><p>{patient.age != null ? `${patient.age} years · ` : ''}{patient.lastVisitAt ? `Last visit ${formatDate(patient.lastVisitAt)}` : 'No visits yet'}</p></div><div className="patient-tags">{patient.nextVisitAt && <span>Next: {formatDay(patient.nextVisitAt)}</span>}{patient.allergies.length ? patient.allergies.slice(0, 2).map(item => <span key={item.substance} className="allergy">{item.substance}</span>) : <span>No known allergies</span>}</div><button className="outline-button" onClick={() => setParams({ patient: patient.id })}>Open patient record</button></article>)}</section>{!patients.length && <EmptyState loading={list.loading}>No assigned patients found.</EmptyState>}<Pager pagination={list.body?.pagination} onChange={setPage} /></>
}

function PatientRecord({ patientId, onClose }) {
  const patient = useApi(`/patients/${patientId}`)
  const records = useApi(recordApi.patientPath(patientId, { limit: 10 }))
  const documents = useApi(documentApi.path({ patientId, limit: 10 }))
  const [error, setError] = useState('')
  const p = patient.data
  async function download(document) { try { await documentApi.download(document) } catch (err) { setError(err.message) } }
  return <section className="card patient-record"><div className="section-title"><div><p>PATIENT RECORD</p><h2>{p?.name || 'Loading…'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close patient record"><X size={18} /></button></div><ErrorMessage>{patient.error || records.error || error}</ErrorMessage>{p && <p>{[p.age != null && `${p.age} years`, p.gender !== 'undisclosed' && statusLabel(p.gender), p.bloodGroup && `Blood group ${p.bloodGroup}`, p.contact.phone].filter(Boolean).join(' · ')}</p>}{p && <div className="patient-tags">{p.allergies.length ? p.allergies.map(item => <span key={item.substance} className="allergy">{item.substance} ({item.severity})</span>) : <span>No known allergies</span>}</div>}<h3>Visit history</h3>{(records.data || []).map(record => <div className="record-line" key={record.id}><b>{formatDate(record.visitAt)} · {record.doctor?.name}</b><span>{record.diagnoses.map(item => item.description).join(', ')}{record.notes ? ` — ${record.notes}` : ''}</span></div>)}{!records.data?.length && <EmptyState loading={records.loading}>No visit summaries yet.</EmptyState>}<h3>Documents</h3>{(documents.data || []).map(document => <div className="record-line" key={document.id}><b>{document.name}</b><span>{document.category} · {formatDate(document.uploadedAt)} · {formatSize(document.sizeBytes)}</span><button className="icon-button" onClick={() => download(document)} aria-label={`Download ${document.name}`}><Download size={16} /></button></div>)}{!documents.data?.length && <EmptyState loading={documents.loading}>No documents uploaded.</EmptyState>}<Link className="primary-button" to={`/doctor/consultations?patient=${patientId}`}>Write consultation note</Link></section>
}

const FOLLOW_UP_DAYS = { '2 weeks': 14, '1 month': 30, 'As needed': null }

export function ConsultationsPage() {
  const [params, setParams] = useSearchParams()
  const [until] = useState(() => new Date(Date.now() + 60 * 60 * 1000).toISOString())
  const recent = useApi(appointmentApi.path({ to: until, status: 'confirmed,checked_in,completed', sort: '-startAt', limit: 20 }))
  const requestedId = params.get('appointment')
  const requestedPatient = params.get('patient')
  const requested = useApi(requestedId ? `/appointments/${requestedId}` : null)
  const options = recent.data || []
  const appointment = requested.data || (requestedPatient ? null : options[0])
  const patientId = appointment?.patientId || requestedPatient
  const patient = useApi(patientId ? `/patients/${patientId}` : null)
  const [formKey, setFormKey] = useState(0)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const started = appointment && new Date(appointment.startAt) <= new Date(until)

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const number = name => (form.get(name) === '' ? undefined : Number(form.get(name)))
    const vitals = Object.fromEntries(Object.entries({ systolicBP: number('systolicBP'), diastolicBP: number('diastolicBP'), heartRate: number('heartRate'), temperatureC: number('temperatureC') }).filter(([, value]) => value !== undefined))
    const followUp = FOLLOW_UP_DAYS[form.get('followUp')]
    const diagnosis = form.get('diagnosis').trim()
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      await recordApi.create({
        patientId,
        ...(appointment && started && appointment.status !== 'cancelled' ? { appointmentId: appointment.id } : {}),
        notes: form.get('notes').trim(),
        diagnoses: diagnosis ? [{ description: diagnosis }] : [],
        vitals,
        followUpRequired: form.get('outcome') === 'Follow-up required',
        ...(followUp ? { followUpInDays: followUp } : {}),
      })
      setSaved(true)
      setFormKey(key => key + 1)
      recent.reload()
      requested.reload()
    } catch (err) {
      setError(err.details?.[0]?.message || err.message)
    } finally {
      setBusy(false)
    }
  }

  const p = patient.data
  return <><PageHeader eyebrow="CLINICAL CARE" title="Consultation management" description="Create accurate consultation notes for your authorised patients." /><div className="directory-tools"><select value={appointment?.id || ''} onChange={e => { setParams(e.target.value ? { appointment: e.target.value } : {}); setSaved(false) }} aria-label="Choose an appointment"><option value="">Choose an appointment</option>{requested.data && !options.some(item => item.id === requested.data.id) && <option value={requested.data.id}>{formatDay(requested.data.startAt)} {formatTime(requested.data.startAt)} · {requested.data.patient?.name}</option>}{options.map(item => <option key={item.id} value={item.id}>{formatDay(item.startAt)} {formatTime(item.startAt)} · {item.patient?.name} · {statusLabel(item.status)}</option>)}</select></div><ErrorMessage>{recent.error || requested.error || patient.error}</ErrorMessage>
    {patientId ? <section className="consultation-layout"><article className="card consultation-patient"><PatientAvatar initials={p?.initials} /><h2>{p?.name || 'Loading…'}</h2><p>{p?.age != null ? `${p.age} years` : ''}{appointment ? ` · ${formatDay(appointment.startAt)}, ${formatTime(appointment.startAt)}` : ''}</p><hr />{appointment && <><b>Reason for visit</b><span>{appointment.reason}</span></>}<b>Known alerts</b>{p?.allergies.length ? p.allergies.map(item => <span key={item.substance} className="allergy">{item.substance} allergy ({item.severity})</span>) : <span>No allergies recorded</span>}<Link className="outline-button full-width" to={`/doctor/patients?patient=${patientId}`}>Open full patient record</Link></article><form key={formKey} className="card consultation-form" onSubmit={submit}><h2>Consultation note</h2><p>{appointment && !started ? 'This appointment has not started yet, so the note will be saved without completing the appointment.' : 'Record relevant clinical details after the consultation. Saving completes the linked appointment.'}</p><label>Assessment<textarea name="notes" placeholder="Clinical assessment, observations, and outcomes…" maxLength="5000" required /></label><label>Diagnosis<input name="diagnosis" placeholder="e.g. Essential hypertension" maxLength="300" /></label><div className="form-grid"><label>Systolic BP<input name="systolicBP" type="number" min="40" max="300" /></label><label>Diastolic BP<input name="diastolicBP" type="number" min="20" max="200" /></label><label>Heart rate<input name="heartRate" type="number" min="20" max="250" /></label><label>Temperature (°C)<input name="temperatureC" type="number" min="30" max="45" step="0.1" /></label><label>Follow-up<select name="followUp" defaultValue="2 weeks">{Object.keys(FOLLOW_UP_DAYS).map(item => <option key={item}>{item}</option>)}</select></label><label>Consultation status<select name="outcome" defaultValue="Completed"><option>Completed</option><option>Follow-up required</option></select></label></div>{saved && <p className="save-message"><CheckCircle2 size={16} /> Consultation note saved to the patient record.</p>}<ErrorMessage>{error}</ErrorMessage><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save consultation note'}</button></form></section> : <EmptyState loading={recent.loading}>Choose an appointment to write a consultation note.</EmptyState>}</>
}

export function DoctorProfilePage() {
  const { updateUser } = useAuth()
  const { data: doctor, error, reload } = useApi('/doctors/me')
  if (!doctor) return <><PageHeader eyebrow="PROFESSIONAL PROFILE" title="My professional profile" /><ErrorMessage>{error}</ErrorMessage><EmptyState loading={!error} /></>
  return <DoctorProfileForm doctor={doctor} onSaved={data => { updateUser({ name: data.fullName, initials: data.initials }); reload() }} />
}

function DoctorProfileForm({ doctor, onSaved }) {
  const [availability, setAvailability] = useState(doctor.availability)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function updateBlock(index, field, value) { setAvailability(availability.map((block, i) => (i === index ? { ...block, [field]: field === 'dayOfWeek' || field === 'slotMinutes' ? Number(value) : value } : block))) }

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setSaved(false)
    setError('')
    try {
      const { data } = await doctorApi.update(doctor.id, {
        fullName: form.get('fullName'),
        specialty: form.get('specialty'),
        hospital: form.get('hospital'),
        city: form.get('city'),
        experienceYears: Number(form.get('experienceYears') || 0),
        consultationFee: Number(form.get('consultationFee') || 0),
        about: form.get('about'),
        availability,
      })
      setSaved(true)
      onSaved(data)
    } catch (err) {
      setError(err.details?.[0]?.message || err.message)
    } finally {
      setBusy(false)
    }
  }

  return <><PageHeader eyebrow="PROFESSIONAL PROFILE" title="My professional profile" description="Keep your public directory details and weekly availability current." /><form className="card details-form doctor-profile-form" onSubmit={submit}><div className="doctor-profile-head"><span className={`doctor-avatar ${doctor.color || 'teal'} large`}>{doctor.initials}</span><div><h2>{doctor.name}</h2><p>{doctor.specialty} · {doctor.hospital}</p></div><StatusBadge>{doctor.verificationStatus}</StatusBadge></div><div className="form-grid"><label>Display name<input name="fullName" defaultValue={doctor.fullName} minLength="2" required /></label><label>Specialty<input name="specialty" defaultValue={doctor.specialty} minLength="2" required /></label><label>Hospital<input name="hospital" defaultValue={doctor.hospital} /></label><label>City<input name="city" defaultValue={doctor.city} /></label><label>Consultation fee (Rs.)<input name="consultationFee" type="number" min="0" defaultValue={doctor.consultationFee} /></label><label>Years of experience<input name="experienceYears" type="number" min="0" max="70" defaultValue={doctor.experienceYears} /></label></div><label>About<textarea name="about" defaultValue={doctor.about} maxLength="1000" /></label><h3>Weekly availability</h3>{availability.map((block, index) => <div className="availability-row" key={index}><select value={block.dayOfWeek} onChange={e => updateBlock(index, 'dayOfWeek', e.target.value)} aria-label="Day">{DAY_NAMES.map((name, day) => <option key={name} value={day}>{name}</option>)}</select><input type="time" value={block.startTime} onChange={e => updateBlock(index, 'startTime', e.target.value)} aria-label="Start time" required /><input type="time" value={block.endTime} onChange={e => updateBlock(index, 'endTime', e.target.value)} aria-label="End time" required /><select value={block.slotMinutes} onChange={e => updateBlock(index, 'slotMinutes', e.target.value)} aria-label="Slot length">{[15, 20, 30, 45, 60].map(minutes => <option key={minutes} value={minutes}>{minutes} min slots</option>)}</select><button type="button" className="icon-button" onClick={() => setAvailability(availability.filter((_, i) => i !== index))} aria-label="Remove availability"><Trash2 size={16} /></button></div>)}<button type="button" className="outline-button" disabled={availability.length >= 21} onClick={() => setAvailability([...availability, { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', slotMinutes: 30 }])}><Plus size={16} /> Add availability</button>{saved && <p className="save-message"><CheckCircle2 size={16} /> Your profile was saved.</p>}<ErrorMessage>{error}</ErrorMessage><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></form></>
}
