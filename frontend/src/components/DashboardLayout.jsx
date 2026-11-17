/*
 * Project: MediMind
 * Developer: Tharushi Kumari
 * GitHub: https://github.com/vihanga2k5
 */

import { useState } from 'react'
import { Bell, Bot, CalendarDays, ChevronDown, FileText, LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck, Stethoscope, Users } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Brand from './Brand'

const patientLinks = [
  ['Overview', '/patient/dashboard', LayoutDashboard], ['Find a doctor', '/patient/doctors', Search], ['Appointments', '/patient/appointments', CalendarDays], ['Medical records', '/patient/records', FileText], ['AI health assistant', '/patient/assistant', Bot], ['My profile', '/patient/profile', Settings],
]
const doctorLinks = [
  ['Overview', '/doctor/dashboard', LayoutDashboard], ['My appointments', '/doctor/appointments', CalendarDays], ['Patients', '/doctor/patients', Users], ['Consultations', '/doctor/consultations', Stethoscope], ['My profile', '/doctor/profile', Settings],
]
const adminLinks = [
  ['Overview', '/admin/dashboard', LayoutDashboard], ['Doctor management', '/admin/doctors', Stethoscope], ['Appointments', '/admin/appointments', CalendarDays], ['Patients', '/admin/patients', Users], ['Analytics', '/admin/analytics', ShieldCheck], ['Settings', '/admin/settings', Settings],
]

const labels = { patient: 'Patient portal', doctor: 'Doctor portal', admin: 'Admin portal' }

export default function DashboardLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const links = user.role === 'doctor' ? doctorLinks : user.role === 'admin' ? adminLinks : patientLinks

  function logout() { signOut(); navigate('/auth') }
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <Link to={`/${user.role}/dashboard`} className="sidebar-brand"><Brand /></Link>
      <p className="portal-label">{labels[user.role]}</p>
      <nav>{links.map(([label, path, Icon]) => <NavLink key={path} to={path} onClick={() => setMenuOpen(false)}><Icon size={18} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="secure-card"><ShieldCheck size={18} /><span><b>Your data is protected</b><small>Private & secure by design</small></span></div><button className="logout-button" onClick={logout}><LogOut size={17} /> Sign out</button></div>
    </aside>
    {menuOpen && <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close navigation"></button>}
    <section className="main-area">
      <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={22} /></button><div className="topbar-trail"><span>MEDIMIND</span><b>/</b><span>{labels[user.role].toUpperCase()}</span></div><div className="topbar-actions"><button className="icon-button" aria-label="Notifications"><Bell size={19} /><i></i></button><button className="user-menu"><span className="avatar">{user.initials}</span><span className="user-details"><b>{user.name}</b><small>{user.role}</small></span><ChevronDown size={16} /></button></div></header>
      <main className="content"><Outlet /></main>
    </section>
  </div>
}
