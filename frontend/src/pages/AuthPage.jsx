import { useState } from 'react'
import { ArrowRight, BrainCircuit, CheckCircle2, Eye, EyeOff, HeartPulse, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Brand from '../components/Brand'

const roleInfo = { patient: { label: 'Patient', icon: UserRound, text: 'Manage your health journey' }, doctor: { label: 'Doctor', icon: HeartPulse, text: 'Manage patients and consultations' }, admin: { label: 'Administrator', icon: ShieldCheck, text: 'Manage the MediMind platform' } }

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [role, setRole] = useState('patient')
  const [showPassword, setShowPassword] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isLogin = mode === 'login'

  function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const user = signIn(role, form.get('name'))
    navigate(location.state?.from?.pathname || `/${user.role}/dashboard`)
  }

  return <main className="auth-page">
    <section className="auth-intro"><div className="auth-intro-inner"><Brand /><div className="intro-copy"><p className="intro-label">YOUR HEALTH COMPANION</p><h1>Care that thinks <em>ahead.</em></h1><p>One secure place to understand, manage, and feel confident about your health.</p></div><div className="intro-points"><span><CheckCircle2 size={17} /> Trusted clinical care</span><span><CheckCircle2 size={17} /> Smarter health insights</span><span><CheckCircle2 size={17} /> Your data, protected</span></div><div className="wellness-card"><div><span>Today&apos;s wellness</span><b>Looking good</b><small>Keep caring for you</small></div><HeartPulse size={31} /><div className="heart-line">〰〰⌁〰〰</div></div></div></section>
    <section className="auth-form-area"><div className="auth-form-wrap"><div className="mobile-only"><Brand /></div><div className="auth-heading"><p>{isLogin ? 'WELCOME BACK' : 'GET STARTED'}</p><h2>{isLogin ? 'Good to see you.' : 'Create your account.'}</h2><span>{isLogin ? 'Sign in to continue your health journey.' : 'Start taking charge of your wellbeing today.'}</span></div>
      <div className="auth-tabs"><button className={isLogin ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button><button className={!isLogin ? 'active' : ''} onClick={() => { setMode('register'); setRole('patient') }}>Create account</button></div>
      {isLogin && <div className="role-picker"><p>Continue as</p><div>{Object.entries(roleInfo).map(([key, item]) => { const Icon = item.icon; return <button type="button" key={key} className={role === key ? 'selected' : ''} onClick={() => setRole(key)}><Icon size={16} /><span>{item.label}</span></button> })}</div></div>}
      <form className="auth-form" onSubmit={submit}>{!isLogin && <label>Full name <span className="field"><UserRound size={17} /><input name="name" placeholder="Enter your full name" required /></span></label>}<label>Email address <span className="field"><Mail size={17} /><input name="email" type="email" placeholder="you@example.com" required /></span></label><label>Password <span className="field"><LockKeyhole size={17} /><input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" minLength="8" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Show or hide password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label><div className="auth-options">{isLogin ? <label className="remember"><input type="checkbox" /> Remember me</label> : <span>By registering, you accept our Terms and Privacy Policy.</span>}{isLogin && <button type="button">Forgot password?</button>}</div><button className="primary-button auth-submit" type="submit">{isLogin ? `Sign in as ${roleInfo[role].label}` : 'Create patient account'} <ArrowRight size={18} /></button></form>
      <p className="api-note"><BrainCircuit size={16} /> Demo interface: authentication will connect to the Node.js API later.</p><div className="auth-switch">{isLogin ? 'New to MediMind?' : 'Already have an account?'} <button onClick={() => setMode(isLogin ? 'register' : 'login')}>{isLogin ? 'Create an account' : 'Sign in'}</button></div></div></section>
  </main>
}
