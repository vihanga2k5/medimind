import { Fragment, useDeferredValue, useState } from 'react'
import { ArrowLeft, Bot, CalendarDays, CheckCircle2, Download, FileText, Filter, HeartPulse, MapPin, MessageCircle, Plus, Search, Send, ShieldCheck, SlidersHorizontal, Star, Trash2, Upload, Video, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import SlotPicker from '../../components/SlotPicker'
import { EmptyState, ErrorMessage, Pager } from '../../components/Feedback'
import { useAuth } from '../../context/AuthContext'
import { useApi } from '../../hooks/useApi'
import { aiApi, appointmentApi, doctorApi, documentApi, patientApi, recordApi } from '../../services/api'
import { consultationLabel, firstName, formatDate, formatDateTime, formatSize, formatTime } from '../../utils/format'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const GENDERS = [['undisclosed', 'Prefer not to say'], ['female', 'Female'], ['male', 'Male'], ['other', 'Other']]
const SEVERITIES = ['Mild', 'Moderate', 'Severe']

function DoctorAvatar({ doctor, large = false }) { return <div className={`doctor-avatar ${doctor?.color || 'teal'} ${large ? 'large' : ''}`}>{doctor?.initials}</div> }

export function DoctorsPage() {
  const [query, setQuery] = useState('')
  const [specialty, setSpecialty] = useState('All specialties')
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState('-rating')
  const [minRating, setMinRating] = useState('')
  const [page, setPage] = useState(1)
  const search = useDeferredValue(query.trim())
  const { body, error, loading } = useApi(doctorApi.path({ q: search, specialty: specialty === 'All specialties' ? '' : specialty, sort, minRating, page, limit: 12 }))
  const shown = body?.data || []
  function change(setter) { return event => { setter(event.target.value); setPage(1) } }
  return <><PageHeader eyebrow="CARE DIRECTORY" title="Find the right doctor." description="Search trusted healthcare professionals and book the care you need." /><div className="directory-tools"><div className="search-box"><Search size={19} /><input value={query} onChange={change(setQuery)} placeholder="Search by doctor name or specialty" /></div><select value={specialty} onChange={change(setSpecialty)}><option>All specialties</option>{(body?.specialties || []).map(s => <option key={s}>{s}</option>)}</select><button className="outline-button" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} /> More filters</button></div>
    {showFilters && <div className="directory-tools"><select value={sort} onChange={change(setSort)} aria-label="Sort doctors"><option value="-rating">Highest rated</option><option value="-experienceYears">Most experienced</option><option value="consultationFee">Lowest fee</option><option value="fullName">Name (A–Z)</option></select><select value={minRating} onChange={change(setMinRating)} aria-label="Minimum rating"><option value="">Any rating</option><option value="4.5">4.5 and above</option><option value="4">4.0 and above</option></select></div>}
    <ErrorMessage>{error}</ErrorMessage><p className="result-count">{loading ? 'Searching…' : `${body?.pagination?.total ?? 0} healthcare professionals available`}</p><section className="doctor-grid">{shown.map(doctor => <article className="doctor-card" key={doctor.id}><div className="doctor-card-top"><DoctorAvatar doctor={doctor} />{doctor.verificationStatus === 'verified' && <span className="verified"><CheckCircle2 size={15} /> Verified</span>}</div><h2>{doctor.name}</h2><p className="specialty">{doctor.specialty}</p><p className="hospital"><MapPin size={14} /> {doctor.hospital}{doctor.city ? `, ${doctor.city}` : ''}</p><div className="doctor-meta"><span><Star size={14} fill="currentColor" /> {doctor.rating ?? '–'} <small>({doctor.reviews ?? 0})</small></span><span>{doctor.experience}</span></div><div className="next-slot"><CalendarDays size={15} /><span><b>Next available</b>{doctor.nextAvailableAt ? formatDateTime(doctor.nextAvailableAt) : 'No open slots in the next 2 weeks'}</span></div><Link className="outline-button full-width" to={`/patient/doctors/${doctor.id}`}>View profile</Link></article>)}</section>{!loading && !shown.length && <EmptyState>No doctors match your search.</EmptyState>}<Pager pagination={body?.pagination} onChange={setPage} /></> }

export function DoctorProfilePage() {
  const { doctorId } = useParams()
  const navigate = useNavigate()
  const { data: doctor, error } = useApi(`/doctors/${doctorId}`)
  const [slot, setSlot] = useState(null)
  const [reason, setReason] = useState('')
  const [type, setType] = useState('in_person')
  const [booked, setBooked] = useState(null)
  const [bookError, setBookError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)

  function pick(value) { setSlot(value); setBookError(''); if (value) setBooked(null) }

  async function book(event) {
    event.preventDefault()
    setBusy(true)
    setBookError('')
    try {
      const { data } = await appointmentApi.book({ doctorId, startAt: slot, consultationType: type, reason })
      setBooked(data)
      setSlot(null)
      setReason('')
    } catch (err) {
      setBookError(err.details?.[0]?.message || err.message)
    } finally {
      setBusy(false)
      setRefresh(value => value + 1)
    }
  }

  if (error) return <><button className="back-button" onClick={() => navigate('/patient/doctors')}><ArrowLeft size={17} /> Back to doctor directory</button><ErrorMessage>{error}</ErrorMessage></>
  if (!doctor) return <EmptyState loading />
  return <><button className="back-button" onClick={() => navigate('/patient/doctors')}><ArrowLeft size={17} /> Back to doctor directory</button><section className="profile-hero card"><DoctorAvatar doctor={doctor} large /><div className="profile-main">{doctor.verificationStatus === 'verified' && <span className="verified"><CheckCircle2 size={15} /> Verified professional</span>}<h1>{doctor.name}</h1><p>{doctor.specialty} · {doctor.hospital}</p><div className="profile-meta"><span><Star size={15} fill="currentColor" /> {doctor.rating ?? '–'} rating ({doctor.reviews ?? 0} reviews)</span><span>{doctor.experience} experience</span></div></div><div className="profile-price"><span>Consultation fee</span><b>{doctor.fee}</b></div></section><section className="profile-grid"><article className="card about-card"><h2>About {firstName(doctor.name)}</h2><p>{doctor.about || `${doctor.name} is a ${doctor.specialty.toLowerCase()} at ${doctor.hospital}.`}</p>{doctor.expertise?.length > 0 && <><h3>Areas of expertise</h3><div className="tag-list">{doctor.expertise.map(item => <span key={item}>{item}</span>)}</div></>}<h3>Clinic location</h3><p className="hospital"><MapPin size={15} /> {doctor.hospital}{doctor.city ? `, ${doctor.city}` : ''}</p></article><aside className="card booking-card"><p>BOOK AN APPOINTMENT</p><h2>Choose a time</h2><SlotPicker doctorId={doctorId} selected={slot} onSelect={pick} refresh={refresh} />
    {booked && <div className="booking-success"><CheckCircle2 size={20} /> Booked for {formatDateTime(booked.startAt)}. <Link to="/patient/appointments" className="text-link">View appointments</Link></div>}
    {slot && <form className="booking-form" onSubmit={book}><label>Reason for visit<input value={reason} onChange={e => setReason(e.target.value)} placeholder="Briefly describe your concern" minLength="3" maxLength="500" required /></label><label>Consultation type<select value={type} onChange={e => setType(e.target.value)}><option value="in_person">In-person</option><option value="online">Video consultation</option></select></label><ErrorMessage>{bookError}</ErrorMessage><button className="primary-button full-width" disabled={busy}>{busy ? 'Booking…' : `Confirm ${formatTime(slot)} slot`}</button></form>}
    {!slot && <ErrorMessage>{bookError}</ErrorMessage>}</aside></section></>
}

const APPOINTMENT_TABS = {
  Upcoming: { scope: 'upcoming', status: 'pending,confirmed,checked_in' },
  History: { scope: 'past', status: 'pending,confirmed,checked_in,completed,no_show' },
  Cancelled: { status: 'cancelled', sort: '-startAt' },
}

export function AppointmentsPage() {
  const [tab, setTab] = useState('Upcoming')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [rescheduling, setRescheduling] = useState(null)
  const list = useApi(appointmentApi.path({ ...APPOINTMENT_TABS[tab], page, limit: 10 }))
  const selected = list.data || []

  function switchTab(next) { setTab(next); setPage(1); setMessage(''); setError(''); setRescheduling(null) }

  function rescheduled(appointment) {
    setRescheduling(null)
    setMessage(`Your appointment with ${appointment.doctor?.name} was moved to ${formatDateTime(appointment.startAt)}.`)
    list.reload()
  }

  async function cancel(item) {
    if (!window.confirm(`Cancel your appointment with ${item.doctor?.name} on ${formatDateTime(item.startAt)}?`)) return
    setError('')
    try {
      await appointmentApi.setStatus(item.id, 'cancelled', 'Cancelled by patient')
      setMessage('Your appointment was cancelled and the time slot has been released.')
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return <><PageHeader eyebrow="MY CARE" title="Appointments" description="Keep track of your consultations and care history." actions={<Link className="primary-button" to="/patient/doctors"><CalendarDays size={17} /> Book appointment</Link>} /><div className="sub-tabs">{Object.keys(APPOINTMENT_TABS).map(name => <button key={name} className={tab === name ? 'active' : ''} onClick={() => switchTab(name)}>{name}</button>)}</div>{message && <p className="save-message"><CheckCircle2 size={16} /> {message}</p>}<ErrorMessage>{error || list.error}</ErrorMessage><section className="appointment-list">{selected.map(item => <Fragment key={item.id}><article className="card appointment-row"><DoctorAvatar doctor={item.doctor} /><div><h2>{item.doctor?.name}</h2><p>{item.doctor?.specialty} · {item.reason}</p><div className="appointment-details"><span><CalendarDays size={15} /> {formatDate(item.startAt)}</span><span>{formatTime(item.startAt)}</span><span>{item.consultationType === 'online' ? <Video size={15} /> : <MapPin size={15} />}{consultationLabel(item.consultationType)}</span></div></div><div className="appointment-status"><StatusBadge>{item.status}</StatusBadge>{tab === 'Upcoming' ? <div className="appointment-actions">{RESCHEDULABLE.includes(item.status) && <button className="outline-button" onClick={() => { setRescheduling(rescheduling === item.id ? null : item.id); setMessage(''); setError('') }}>Reschedule</button>}<button className="outline-button" onClick={() => cancel(item)}>Cancel</button></div> : item.status === 'completed' ? <Link className="outline-button" to="/patient/records">View summary</Link> : null}</div></article>{rescheduling === item.id && <RescheduleCard appointment={item} onDone={rescheduled} onClose={() => setRescheduling(null)} />}</Fragment>)}{!selected.length && <EmptyState loading={list.loading}>No {tab.toLowerCase()} appointments.</EmptyState>}</section><Pager pagination={list.body?.pagination} onChange={setPage} /></>
}

const RESCHEDULABLE = ['pending', 'confirmed']

function RescheduleCard({ appointment, onDone, onClose }) {
  const [slot, setSlot] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      const { data } = await appointmentApi.reschedule(appointment.id, slot)
      onDone(data)
    } catch (err) {
      setError(err.details?.[0]?.message || err.message)
      setSlot(null)
      setRefresh(value => value + 1)
      setBusy(false)
    }
  }

  return <section className="card reschedule-card"><div className="section-title"><div><p>RESCHEDULE APPOINTMENT</p><h2>Choose a new time with {appointment.doctor?.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close rescheduling"><X size={18} /></button></div><p>Currently booked for <b>{formatDateTime(appointment.startAt)}</b>. Your current time is kept until the new time is confirmed.</p><SlotPicker doctorId={appointment.doctorId} selected={slot} onSelect={value => { setSlot(value); setError('') }} refresh={refresh} current={appointment.startAt} /><ErrorMessage>{error}</ErrorMessage><div className="reschedule-actions"><button className="outline-button" onClick={onClose}>Keep current time</button><button className="primary-button" disabled={!slot || busy} onClick={confirm}>{busy ? 'Moving…' : slot ? `Move to ${formatDateTime(slot)}` : 'Select a new time'}</button></div></section>
}

const DOCUMENT_CATEGORIES = ['Laboratory', 'Clinical note', 'Imaging', 'Prescription', 'Patient upload', 'Other']

export function RecordsPage() {
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('Patient upload')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const docs = useApi(documentApi.path({ page, limit: 10, category }))
  const visits = useApi(recordApi.path({ limit: 5 }))
  const items = docs.data || []

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setMessage('')
    setError('')
    if (file.size > MAX_UPLOAD_BYTES) return setError('Files must be 5 MB or smaller.')
    setBusy(true)
    try {
      await documentApi.upload(file, { category: uploadCategory })
      setMessage(`${file.name} was uploaded securely.`)
      setPage(1)
      docs.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function download(document) {
    setError('')
    try { await documentApi.download(document) } catch (err) { setError(err.message) }
  }

  return <><PageHeader eyebrow="YOUR HEALTH LIBRARY" title="Medical records" description="Your documents are organised, private, and available whenever you need them." actions={<><select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} aria-label="Document category">{DOCUMENT_CATEGORIES.map(item => <option key={item}>{item}</option>)}</select><label className="primary-button upload-label"><Upload size={17} /> {busy ? 'Uploading…' : 'Upload document'}<input type="file" onChange={upload} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={busy} /></label></>} />{message && <p className="save-message"><CheckCircle2 size={16} /> {message}</p>}<ErrorMessage>{error || docs.error}</ErrorMessage><div className="records-summary"><div><FileText size={20} /><span><b>{docs.body?.pagination?.total ?? 0} documents</b><small>PDF, JPEG or PNG up to 5 MB · securely stored in your health record</small></span></div><button className="outline-button" onClick={() => setShowFilter(!showFilter)}><Filter size={16} /> Filter</button></div>{showFilter && <div className="directory-tools"><select value={category} onChange={e => { setCategory(e.target.value); setPage(1) }} aria-label="Filter by category"><option value="">All categories</option>{DOCUMENT_CATEGORIES.map(item => <option key={item}>{item}</option>)}</select></div>}<section className="record-table card"><div className="record-head"><span>Document</span><span>Category</span><span>Date</span><span>Provider</span><span></span></div>{items.map(record => <div className="record-item" key={record.id}><span className="record-name"><i>{record.type}</i><span><b>{record.name}</b><small>{formatSize(record.sizeBytes)}</small></span></span><span>{record.category}</span><span>{formatDate(record.uploadedAt)}</span><span>{record.provider || 'You'}</span><button className="icon-button" onClick={() => download(record)} aria-label={`Download ${record.name}`}><Download size={17} /></button></div>)}{!items.length && <EmptyState loading={docs.loading}>No documents uploaded yet.</EmptyState>}</section><Pager pagination={docs.body?.pagination} onChange={setPage} />
    <section className="card operations-list"><h2>Recent visit summaries</h2>{(visits.data || []).map(record => <div key={record.id}><span><HeartPulse size={17} /> <b>{formatDate(record.visitAt)}</b> · {record.doctor?.name} · {record.diagnoses.map(item => item.description).join(', ') || record.notes}</span>{record.followUpRequired && <StatusBadge>Follow-up</StatusBadge>}</div>)}{!visits.data?.length && <EmptyState loading={visits.loading}>Visit summaries from your doctors will appear here.</EmptyState>}</section></>
}

export function AssistantPage() {
  const { user } = useAuth()
  const welcome = { sender: 'ai', text: `Hello ${firstName(user.name)}. I’m MediMind AI, here to help you understand health information and prepare for care. How can I support you today?` }
  const [messages, setMessages] = useState([welcome])
  const [conversationId, setConversationId] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  async function send(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setMessages(current => [...current, { sender: 'user', text }])
    setDraft('')
    setBusy(true)
    try {
      const { data } = await aiApi.ask(text, conversationId)
      setConversationId(data.conversationId)
      setMessages(current => [...current, { sender: 'ai', text: data.answer, sources: data.sources, note: data.emergency ? 'Emergency guidance' : data.fallback ? 'The AI service is currently offline, so this is a standard response.' : data.disclaimer }])
    } catch (err) {
      setMessages(current => [...current, { sender: 'ai', text: err.message, note: 'Your message could not be sent.' }])
    } finally {
      setBusy(false)
    }
  }

  function restart() { setMessages([welcome]); setConversationId(null) }

  return <><PageHeader eyebrow="AI HEALTH ASSISTANT" title="How can I help today?" description="Ask general health questions or get help preparing for your next appointment." actions={conversationId && <button className="outline-button" onClick={restart}><Plus size={16} /> New conversation</button>} /><section className="assistant-layout"><article className="card chat-card"><div className="chat-notice"><Bot size={18} /><span>MediMind AI provides general information, not a medical diagnosis.</span></div><div className="messages" aria-live="polite">{messages.map((message, index) => <div className={`message ${message.sender}`} key={index}>{message.sender === 'ai' && <span className="ai-avatar"><Bot size={15} /></span>}<p>{message.text}{message.sources?.length > 0 && <small className="message-note">Sources: {message.sources.join(', ')}</small>}{message.note && <small className="message-note">{message.note}</small>}</p></div>)}{busy && <div className="message ai"><span className="ai-avatar"><Bot size={15} /></span><p>Thinking…</p></div>}</div><form className="chat-input" onSubmit={send}><input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type your health question..." maxLength="1000" /><button className="primary-button" aria-label="Send message" disabled={busy}><Send size={18} /></button></form></article><aside className="assistant-side"><article className="card"><h2>Try asking</h2>{['What should I ask at my cardiology appointment?', 'Explain my blood test results in simple terms.', 'How can I build a healthier routine?'].map(q => <button key={q} onClick={() => setDraft(q)}><MessageCircle size={16} /> {q}</button>)}</article><article className="card urgent-card"><HeartPulse size={22} /><h2>Need urgent help?</h2><p>For a medical emergency, contact local emergency services or visit the nearest hospital.</p></article></aside></section></>
}

const toInputDate = value => (value ? new Date(value).toISOString().slice(0, 10) : '')

export function ProfilePage() {
  const { updateUser, signOut } = useAuth()
  const { data: patient, error, reload } = useApi('/patients/me')
  const [section, setSection] = useState('personal')
  const [saved, setSaved] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(changes, message) {
    setBusy(true)
    setSaved('')
    setSaveError('')
    try {
      const { data } = await patientApi.update(patient.id, changes)
      updateUser({ name: data.fullName, initials: data.initials })
      setSaved(message)
      reload()
    } catch (err) {
      setSaveError(err.details?.[0]?.message || err.message)
    } finally {
      setBusy(false)
    }
  }

  function savePersonal(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    save({
      fullName: `${form.get('firstName')} ${form.get('lastName')}`.trim(),
      dateOfBirth: form.get('dateOfBirth') || null,
      gender: form.get('gender'),
      bloodGroup: form.get('bloodGroup') || null,
      contact: { phone: form.get('phone') },
      address: { city: form.get('city') },
    }, 'Your personal information was saved.')
  }

  if (!patient) return <><PageHeader eyebrow="ACCOUNT SETTINGS" title="My profile" /><ErrorMessage>{error}</ErrorMessage><EmptyState loading={!error} /></>
  const [first, ...rest] = patient.fullName.split(' ')
  const tabs = [['personal', 'Personal information'], ['health', 'Health preferences'], ['privacy', 'Privacy & security']]
  return <><PageHeader eyebrow="ACCOUNT SETTINGS" title="My profile" description="Keep your contact details and healthcare preferences current." /><section className="profile-settings"><aside className="card profile-nav"><div className="big-avatar">{patient.initials}</div><h2>{patient.fullName}</h2><p>Patient account</p>{tabs.map(([key, label]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => { setSection(key); setSaved(''); setSaveError('') }}>{label}</button>)}</aside>
    {section === 'personal' && <form key={patient.updatedAt} className="card details-form" onSubmit={savePersonal}><h2>Personal information</h2><p>These details help your care team identify and support you.</p><div className="form-grid"><label>First name<input name="firstName" defaultValue={first} required /></label><label>Last name<input name="lastName" defaultValue={rest.join(' ')} /></label><label>Email address<input type="email" value={patient.contact.email || ''} readOnly /></label><label>Mobile number<input name="phone" defaultValue={patient.contact.phone || ''} maxLength="30" /></label><label>Date of birth<input name="dateOfBirth" type="date" defaultValue={toInputDate(patient.dateOfBirth)} max={toInputDate(new Date())} /></label><label>Blood group<select name="bloodGroup" defaultValue={patient.bloodGroup || ''}><option value="">Not recorded</option>{BLOOD_GROUPS.map(group => <option key={group}>{group}</option>)}</select></label><label>Gender<select name="gender" defaultValue={patient.gender || 'undisclosed'}>{GENDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>City<input name="city" defaultValue={patient.address.city || ''} maxLength="80" /></label></div>{saved && <p className="save-message"><CheckCircle2 size={16} /> {saved}</p>}<ErrorMessage>{saveError}</ErrorMessage><button className="primary-button" disabled={busy}>Save changes</button></form>}
    {section === 'health' && <HealthPreferences key={patient.updatedAt} patient={patient} onSave={save} busy={busy} saved={saved} error={saveError} />}
    {section === 'privacy' && <section className="card details-form"><h2>Privacy & security</h2><p>How MediMind protects your health information.</p><div className="settings-list"><div><span><ShieldCheck size={19} /></span><section><h2>Who can see your records</h2><p>Only you and doctors you have an appointment with can open your medical records and documents. Administrators cannot read clinical notes.</p></section></div><div><span><FileText size={19} /></span><section><h2>Private document storage</h2><p>Uploaded files are stored privately and are only available through your signed-in account.</p></section></div></div><button className="outline-button" onClick={signOut}>Sign out of this device</button></section>}
  </section></>
}

function HealthPreferences({ patient, onSave, busy, saved, error }) {
  const [allergies, setAllergies] = useState(patient.allergies.map(({ substance, severity, notes }) => ({ substance, severity, ...(notes ? { notes } : {}) })))
  const [substance, setSubstance] = useState('')
  const [severity, setSeverity] = useState('Moderate')

  function add() {
    const name = substance.trim()
    if (!name || allergies.some(item => item.substance.toLowerCase() === name.toLowerCase())) return
    setAllergies([...allergies, { substance: name, severity }])
    setSubstance('')
  }

  function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSave({ allergies, emergencyContact: { name: form.get('contactName'), relationship: form.get('relationship'), phone: form.get('contactPhone') } }, 'Your health preferences were saved.')
  }

  return <form className="card details-form" onSubmit={submit}><h2>Health preferences</h2><p>Allergies and an emergency contact are shared with your assigned doctors.</p><h3>Allergies</h3><div className="tag-list">{allergies.map(item => <span key={item.substance}>{item.substance} · {item.severity} <button type="button" className="tag-remove" onClick={() => setAllergies(allergies.filter(entry => entry !== item))} aria-label={`Remove ${item.substance}`}><Trash2 size={12} /></button></span>)}{!allergies.length && <small>No allergies recorded.</small>}</div><div className="form-grid"><label>Add allergy<input value={substance} onChange={e => setSubstance(e.target.value)} placeholder="e.g. Penicillin" maxLength="100" /></label><label>Severity<select value={severity} onChange={e => setSeverity(e.target.value)}>{SEVERITIES.map(item => <option key={item}>{item}</option>)}</select></label></div><button type="button" className="outline-button" onClick={add}><Plus size={16} /> Add allergy</button><h3>Emergency contact</h3><div className="form-grid"><label>Name<input name="contactName" defaultValue={patient.emergencyContact.name || ''} maxLength="120" /></label><label>Relationship<input name="relationship" defaultValue={patient.emergencyContact.relationship || ''} maxLength="60" /></label><label>Phone<input name="contactPhone" defaultValue={patient.emergencyContact.phone || ''} maxLength="30" /></label></div>{saved && <p className="save-message"><CheckCircle2 size={16} /> {saved}</p>}<ErrorMessage>{error}</ErrorMessage><button className="primary-button" disabled={busy}>Save health preferences</button></form>
}
