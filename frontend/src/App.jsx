import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import AuthPage from './pages/AuthPage'
import PatientDashboard from './pages/patient/PatientDashboard'
import { AppointmentsPage, AssistantPage, DoctorProfilePage, DoctorsPage, ProfilePage, RecordsPage } from './pages/patient/PatientPages'
import { ConsultationsPage, DoctorAppointmentsPage, DoctorDashboard, DoctorProfilePage as DoctorProfile, PatientsPage } from './pages/doctor/DoctorPages'
import { AdminAppointmentsPage, AdminDashboard, AdminDoctorsPage, AdminPatientsPage, AdminSettingsPage, AnalyticsPage } from './pages/admin/AdminPages'

function SecureArea({ role }) { return <ProtectedRoute allowedRoles={[role]}><DashboardLayout /></ProtectedRoute> }
function NotFound() { return <Navigate to="/auth" replace /> }

export default function App() {
  return <AuthProvider><BrowserRouter><Routes>
    <Route path="/" element={<Navigate to="/auth" replace />} />
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/patient" element={<SecureArea role="patient" />}><Route path="dashboard" element={<PatientDashboard />} /><Route path="doctors" element={<DoctorsPage />} /><Route path="doctors/:doctorId" element={<DoctorProfilePage />} /><Route path="appointments" element={<AppointmentsPage />} /><Route path="records" element={<RecordsPage />} /><Route path="assistant" element={<AssistantPage />} /><Route path="profile" element={<ProfilePage />} /></Route>
    <Route path="/doctor" element={<SecureArea role="doctor" />}><Route path="dashboard" element={<DoctorDashboard />} /><Route path="appointments" element={<DoctorAppointmentsPage />} /><Route path="patients" element={<PatientsPage />} /><Route path="consultations" element={<ConsultationsPage />} /><Route path="profile" element={<DoctorProfile />} /></Route>
    <Route path="/admin" element={<SecureArea role="admin" />}><Route path="dashboard" element={<AdminDashboard />} /><Route path="doctors" element={<AdminDoctorsPage />} /><Route path="appointments" element={<AdminAppointmentsPage />} /><Route path="patients" element={<AdminPatientsPage />} /><Route path="analytics" element={<AnalyticsPage />} /><Route path="settings" element={<AdminSettingsPage />} /></Route>
    <Route path="*" element={<NotFound />} />
  </Routes></BrowserRouter></AuthProvider>
}
