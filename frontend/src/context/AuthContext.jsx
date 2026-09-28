import { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)
const TOKEN_KEY = 'khatra_access_token'
const USER_KEY = 'khatra_user'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers })
  } catch {
    throw new Error('SERVER_UNAVAILABLE')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'REQUEST_FAILED')
  return data
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || null } catch { return null }
  })
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) { setLoading(false); return }
    apiFetch('/auth/me').then(({ user }) => setUser(user)).catch(() => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); setUser(null) }).finally(() => setLoading(false))
  }, [])

  const saveSession = ({ token, user }) => { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); setUser(user) }
  const login = async (email, password) => saveSession(await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }))
  const register = async (name, email, password) => saveSession(await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }))
  const logout = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); setUser(null) }

  return <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: Boolean(user) }}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
