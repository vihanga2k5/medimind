/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('medimind-user')) } catch { return null }
  })

  function signIn(role = 'patient', name = '') {
    const roleNames = { patient: 'Tharushi Kumari', doctor: 'Dr. Shabjan', admin: 'Vihanga B. Hettiarachchi' }
    const nextUser = { role, name: name || roleNames[role], initials: role === 'doctor' ? 'BO' : role === 'admin' ? 'NF' : 'VH' }
    localStorage.setItem('medimind-user', JSON.stringify(nextUser))
    setUser(nextUser)
    return nextUser
  }

  function signOut() { localStorage.removeItem('medimind-user'); setUser(null) }
  return <AuthContext.Provider value={{ user, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
