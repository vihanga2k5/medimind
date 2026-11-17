/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authApi, getToken, setToken } from '../services/api'

const AuthContext = createContext(null)
const USER_KEY = 'medimind-user'

function storedUser() {
  if (!getToken()) return null
  try { return JSON.parse(localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)) } catch { return null }
}

function storeUser(user, remember) {
  try {
    localStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(USER_KEY)
    if (user) (remember ? localStorage : sessionStorage).setItem(USER_KEY, JSON.stringify(user))
  } catch { /* storage unavailable */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(storedUser)

  const signOut = useCallback(() => { setToken(null); storeUser(null); setUser(null) }, [])

  function startSession({ token, user: nextUser }, remember = true) {
    setToken(token, remember)
    storeUser(nextUser, remember)
    setUser(nextUser)
    return nextUser
  }

  // The role always comes from the server, never from the sign-in form.
  async function signIn(credentials, remember = true) { return startSession(await authApi.login(credentials), remember) }
  async function register(details) { return startSession(await authApi.register(details)) }

  function updateUser(changes) {
    setUser(previous => {
      const next = { ...previous, ...changes }
      storeUser(next, Boolean(localStorage.getItem(USER_KEY)))
      return next
    })
  }

  useEffect(() => {
    window.addEventListener('medimind:unauthorized', signOut)
    return () => window.removeEventListener('medimind:unauthorized', signOut)
  }, [signOut])

  useEffect(() => {
    if (!getToken()) return
    authApi.me().then(body => {
      setUser(body.user)
      storeUser(body.user, Boolean(localStorage.getItem(USER_KEY)))
    }).catch(() => {})
  }, [])

  return <AuthContext.Provider value={{ user, signIn, register, signOut, updateUser }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
