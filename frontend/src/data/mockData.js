export const doctors = [
  { id: 'bob-odenkirk', name: 'Dr. Bob Odenkirk', specialty: 'Cardiologist', hospital: 'Colombo Heart Centre', experience: '12 years', rating: 4.9, reviews: 126, availability: 'Today, 4:30 PM', fee: 'Rs. 3,500', initials: 'BO', color: 'coral', about: 'Specialises in preventive cardiology, heart rhythm conditions, and long-term cardiac care.' },
  { id: 'aminda-kalpage', name: 'Dr. Aminda Kalpage', specialty: 'General Physician', hospital: 'MediCare Hospital', experience: '9 years', rating: 4.8, reviews: 94, availability: 'Tomorrow, 9:00 AM', fee: 'Rs. 2,500', initials: 'AK', color: 'blue', about: 'Provides thoughtful primary care for adults, from routine check-ups to ongoing health concerns.' },
  { id: 'malitha-bandara', name: 'Dr. Malitha Bandara', specialty: 'Dermatologist', hospital: 'Skin & Wellness Clinic', experience: '7 years', rating: 4.9, reviews: 81, availability: 'Fri, 2:00 PM', fee: 'Rs. 3,000', initials: 'MB', color: 'purple', about: 'Focused on evidence-based skin, hair, and nail care for patients of all ages.' },
  { id: 'cheveen-ranasinghe', name: 'Dr. Cheveen Ranasinghe', specialty: 'Neurologist', hospital: 'National Neuro Centre', experience: '14 years', rating: 4.7, reviews: 112, availability: 'Mon, 10:30 AM', fee: 'Rs. 4,000', initials: 'CR', color: 'gold', about: 'Experienced in headaches, migraines, nerve conditions, and neurological consultations.' },
]

export const appointments = [
  { id: 'APT-2401', doctor: doctors[0], date: '18 Nov 2026', time: '4:30 PM', type: 'Video consultation', status: 'Confirmed', reason: 'Routine cardiac check-up' },
  { id: 'APT-2387', doctor: doctors[1], date: '02 Nov 2026', time: '10:00 AM', type: 'In-person', status: 'Completed', reason: 'Seasonal allergy review' },
  { id: 'APT-2359', doctor: doctors[2], date: '18 Oct 2026', time: '2:00 PM', type: 'Video consultation', status: 'Completed', reason: 'Skin consultation' },
]

export const records = [
  { id: 'REC-01', name: 'Blood Test Results', category: 'Laboratory', date: '02 Nov 2026', provider: 'MediCare Laboratory', type: 'PDF', size: '1.2 MB' },
  { id: 'REC-02', name: 'Cardiology Consultation', category: 'Clinical note', date: '12 Oct 2026', provider: 'Colombo Heart Centre', type: 'PDF', size: '860 KB' },
  { id: 'REC-03', name: 'Chest X-Ray', category: 'Imaging', date: '28 Sep 2026', provider: 'City Imaging', type: 'JPG', size: '2.4 MB' },
]

export const doctorAppointments = [
  { id: 'D-101', patient: 'Tharushi Kumari', initials: 'TK', age: 27, time: '09:00 AM', type: 'Video', reason: 'Follow-up consultation', status: 'Confirmed' },
  { id: 'D-102', patient: 'Sudam Rajapakshe', initials: 'SR', age: 34, time: '10:30 AM', type: 'In-person', reason: 'Palpitations assessment', status: 'Checked in' },
  { id: 'D-103', patient: 'Zaheer Abbas', initials: 'ZA', age: 45, time: '01:00 PM', type: 'Video', reason: 'Blood pressure review', status: 'Confirmed' },
  { id: 'D-104', patient: 'Dhanushi Navarathana', initials: 'DN', age: 52, time: '03:15 PM', type: 'In-person', reason: 'Annual cardiac review', status: 'Pending' },
]

export const adminMetrics = [
  { label: 'Registered patients', value: '1,284', change: '+12.5%', tone: 'teal' },
  { label: 'Active doctors', value: '48', change: '+4 this month', tone: 'blue' },
  { label: 'Appointments this month', value: '736', change: '+18.2%', tone: 'coral' },
  { label: 'AI consultations', value: '2,419', change: '+24.1%', tone: 'purple' },
]

export const activity = [
  { title: 'Dr. Basuru Wijesinghe joined the platform', time: '12 minutes ago', type: 'doctor' },
  { title: 'New appointment booked with Dr. Bob Odenkirk', time: '24 minutes ago', type: 'appointment' },
  { title: 'Monthly platform report is ready to review', time: '1 hour ago', type: 'report' },
  { title: 'Three new medical records were securely uploaded', time: '2 hours ago', type: 'record' },
]
