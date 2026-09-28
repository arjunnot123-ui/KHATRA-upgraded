import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function Login() {
  const { user, login, register } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to={location.state?.from || '/'} replace />

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      if (mode === 'login') await login(email, password)
      else await register(name, email, password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      const messages = { INVALID_CREDENTIALS: 'Invalid email or password.', EMAIL_ALREADY_EXISTS: 'An account with this email already exists.', NAME_EMAIL_PASSWORD_REQUIRED: 'Enter a name, email and password of at least 8 characters.', SERVER_UNAVAILABLE: 'Unable to connect to the KHATRA server. Start the backend server and make sure PostgreSQL is running.' }
      setError(messages[err.message] || 'Unable to connect to the KHATRA server.')
    } finally { setBusy(false) }
  }

  return <div className="max-w-md mx-auto px-5 py-16">
    <p className="font-mono text-amber text-xs tracking-[0.2em] uppercase mb-3">KHATRA ACCESS</p>
    <h1 className="font-display font-bold text-4xl uppercase mb-3">{mode === 'login' ? 'Worker Login' : 'Create Account'}</h1>
    <p className="text-concrete text-sm mb-8">Sign in to sync training progress, assessments and certificates securely.</p>
    <form onSubmit={submit} className="bg-steel-light border border-steel-lighter rounded-lg p-6 space-y-4">
      {mode === 'register' && <Field label="Full name" value={name} onChange={setName} />}
      <Field label="Email" type="email" value={email} onChange={setEmail} />
      <Field label="Password" type="password" value={password} onChange={setPassword} />
      {error && <p className="text-hazard text-xs font-mono border border-hazard/40 rounded p-3">{error}</p>}
      <button disabled={busy} className="w-full bg-amber text-steel font-display font-bold text-lg uppercase py-3 rounded disabled:opacity-50">{busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Register'}</button>
    </form>
    <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }} className="w-full mt-5 text-concrete text-sm hover:text-amber underline">{mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}</button>
  </div>
}

function Field({ label, type='text', value, onChange }) { return <label className="block"><span className="font-mono text-[10px] uppercase tracking-widest text-concrete">{label}</span><input required type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full mt-2 bg-steel border border-steel-lighter rounded px-4 py-3 font-mono text-sm focus:border-amber outline-none" /></label> }
