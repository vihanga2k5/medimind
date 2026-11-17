import { useState } from 'react'
import { ArrowRight, BrainCircuit, CheckCircle2, Eye, EyeOff, HeartPulse, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Brand from '../components/Brand'
import { ErrorMessage } from '../components/Feedback'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const { user, signIn, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isLogin = mode === 'login'

  if (user) return <Navigate to={`/${user.role}/dashboard`} replace />

  function switchMode(next) { setMode(next); setError(''); setNotice('') }

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const details = { email: form.get('email'), password: form.get('password') }
    setBusy(true)
    setError('')
    try {
      const signedIn = isLogin ? await signIn(details, form.get('remember') === 'on') : await register({ ...details, name: form.get('name') })
      const from = location.state?.from?.pathname
      navigate(from?.startsWith(`/${signedIn.role}/`) ? from : `/${signedIn.role}/dashboard`, { replace: true })
    } catch (err) {
      setError(err.details?.[0]?.message || err.message)
      setBusy(false)
    }
  }

  return <main className="auth-page">
    <section className="auth-intro"><div className="auth-intro-inner"><Brand /><div className="intro-copy"><p className="intro-label">YOUR HEALTH COMPANION</p><h1>Care that thinks <em>ahead.</em></h1><p>One secure place to understand, manage, and feel confident about your health.</p></div><div className="intro-points"><span><CheckCircle2 size={17} /> Trusted clinical care</span><span><CheckCircle2 size={17} /> Smarter health insights</span><span><CheckCircle2 size={17} /> Your data, protected</span></div><div className="wellness-card"><div><span>Today&apos;s wellness</span><b>Looking good</b><small>Keep caring for you</small></div><HeartPulse size={31} /><div className="heart-line">〰〰⌁〰〰</div></div></div></section>
    <section className="auth-form-area"><div className="auth-form-wrap"><div className="mobile-only"><Brand /></div><div className="auth-heading"><p>{isLogin ? 'WELCOME BACK' : 'GET STARTED'}</p><h2>{isLogin ? 'Good to see you.' : 'Create your account.'}</h2><span>{isLogin ? 'Sign in to continue your health journey.' : 'Start taking charge of your wellbeing today.'}</span></div>
      <div className="auth-tabs"><button className={isLogin ? 'active' : ''} onClick={() => switchMode('login')}>Sign in</button><button className={!isLogin ? 'active' : ''} onClick={() => switchMode('register')}>Create account</button></div>
      <form className="auth-form" onSubmit={submit}>{!isLogin && <label>Full name <span className="field"><UserRound size={17} /><input name="name" placeholder="Enter your full name" minLength="2" required /></span></label>}<label>Email address <span className="field"><Mail size={17} /><input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></span></label><label>Password <span className="field"><LockKeyhole size={17} /><input name="password" type={showPassword ? 'text' : 'password'} placeholder={isLogin ? 'Enter your password' : 'At least 8 characters with a number'} minLength="8" autoComplete={isLogin ? 'current-password' : 'new-password'} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Show or hide password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label><div className="auth-options">{isLogin ? <label className="remember"><input name="remember" type="checkbox" defaultChecked /> Remember me</label> : <span>By registering, you accept our Terms and Privacy Policy.</span>}{isLogin && <button type="button" onClick={() => setNotice('Please contact your clinic administrator to reset your password.')}>Forgot password?</button>}</div><ErrorMessage>{error}</ErrorMessage>{notice && <p className="save-message"><CheckCircle2 size={16} /> {notice}</p>}<button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create patient account'} <ArrowRight size={18} /></button></form>
      <p className="api-note"><BrainCircuit size={16} /> {isLogin ? 'You will be taken to the patient, doctor, or administrator portal for your account.' : 'Doctor and administrator accounts are created by the MediMind team.'}</p><div className="auth-switch">{isLogin ? 'New to MediMind?' : 'Already have an account?'} <button onClick={() => switchMode(isLogin ? 'register' : 'login')}>{isLogin ? 'Create an account' : 'Sign in'}</button></div></div></section>
  </main>
}
