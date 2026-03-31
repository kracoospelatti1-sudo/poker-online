import { useState } from 'react'

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export default function Auth({ onAuthSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    const safeUsername = username.trim().toLowerCase()
    if (!safeUsername || !password) {
      setError('Completa usuario y password.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: safeUsername, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'No se pudo iniciar sesion.')
      if (!data?.token || !data?.user) throw new Error('Respuesta de login invalida.')
      onAuthSuccess({ token: data.token, user: data.user })
    } catch (err) {
      setError(err?.message || 'No se pudo iniciar sesion.')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #050d1a 0%, #0a1628 45%, #070f1e 100%)' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {['S', 'H', 'D', 'C'].map((s, i) => (
          <div
            key={s}
            className="absolute font-black opacity-[0.035]"
            style={{
              fontSize: '20rem',
              top: `${[6, -8, 40, 55][i]}%`,
              left: `${[-5, 70, -8, 72][i]}%`,
              transform: 'rotate(-15deg)',
              color: i === 1 || i === 2 ? '#ef4444' : '#fff',
              filter: 'blur(1px)',
            }}
          >
            {s}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1
            className="font-display text-6xl tracking-wider"
            style={{ color: '#f59e0b', textShadow: '0 0 40px rgba(245,158,11,0.5), 0 2px 0 rgba(0,0,0,0.5)' }}
          >
            POKER
          </h1>
          <p className="text-slate-500 text-xs tracking-[0.3em] uppercase mt-1">Acceso de cuentas</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 sm:p-7 space-y-5 border"
          style={{
            background: 'rgba(13,20,35,0.95)',
            borderColor: 'rgba(255,255,255,0.07)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div>
            <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setError('')
              }}
              maxLength={32}
              autoFocus
              className="w-full bg-slate-900/70 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-500 transition-colors"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              className="w-full bg-slate-900/70 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-500 transition-colors"
              placeholder="Tu password"
            />
          </div>

          {error && (
            <div
              className="text-red-400 text-sm text-center py-2 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl font-display text-2xl tracking-widest transition-all active:scale-95 text-black disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 60%, #b45309 100%)',
              boxShadow: '0 0 30px rgba(245,158,11,0.35), 0 4px 15px rgba(0,0,0,0.3)',
            }}
          >
            {loading ? 'Ingresando...' : 'Entrar'}
          </button>

          <div className="text-center text-xs text-slate-500">
            Si es la primera vez: usuario <span className="font-mono text-slate-300">admin</span> / password{' '}
            <span className="font-mono text-slate-300">admin1234</span>
          </div>
        </form>
      </div>
    </div>
  )
}
