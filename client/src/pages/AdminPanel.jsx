import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

function UserRow({ user }) {
  return (
    <div className="grid grid-cols-[1.3fr_1fr_0.8fr] gap-2 text-xs sm:text-sm px-3 py-2 rounded-lg border border-white/10 bg-black/20">
      <div className="min-w-0">
        <div className="text-white font-semibold truncate">{user.username}</div>
        <div className="text-slate-500 truncate">{user.name}</div>
      </div>
      <div className="text-slate-300 truncate">{new Date(user.createdAt).toLocaleString()}</div>
      <div className={`font-bold ${user.role === 'admin' ? 'text-yellow-400' : 'text-emerald-400'}`}>{user.role}</div>
    </div>
  )
}

export default function AdminPanel({ auth, onContinue, onLogout }) {
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ username: '', name: '', password: '', role: 'player' })
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState('')

  const loadUsers = async () => {
    setLoadingUsers(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'No se pudo cargar usuarios.')
      setUsers(Array.isArray(data?.users) ? data.users : [])
    } catch (err) {
      setError(err?.message || 'No se pudo cargar usuarios.')
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (busy) return

    const username = form.username.trim().toLowerCase()
    if (!username || !form.password) {
      setError('Completa username y password para crear la cuenta.')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          username,
          name: form.name.trim(),
          password: form.password,
          role: form.role,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'No se pudo crear la cuenta.')

      setUsers((prev) => [data.user, ...prev])
      setForm({ username: '', name: '', password: '', role: 'player' })
      setSuccess(`Cuenta creada: ${data.user.username}`)
    } catch (err) {
      setError(err?.message || 'No se pudo crear la cuenta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="min-h-screen p-4 sm:p-6"
      style={{ background: 'linear-gradient(160deg, #050d1a 0%, #0a1628 45%, #070f1e 100%)' }}
    >
      <div className="max-w-4xl mx-auto space-y-5">
        <div
          className="rounded-2xl p-5 border"
          style={{
            background: 'rgba(13,20,35,0.95)',
            borderColor: 'rgba(255,255,255,0.07)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <h1 className="font-display text-4xl text-yellow-400 tracking-wider">Panel Admin</h1>
              <p className="text-slate-500 text-sm mt-1">
                Sesion: <span className="text-slate-300 font-semibold">{auth.user.username}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onContinue}
                className="px-4 py-2 rounded-lg border border-yellow-500/40 text-yellow-300 hover:text-yellow-200 transition-colors"
                style={{ background: 'rgba(245,158,11,0.08)' }}
              >
                Ir al lobby
              </button>
              <button
                onClick={onLogout}
                className="px-4 py-2 rounded-lg border border-white/15 text-slate-300 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                Cerrar sesion
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form
            onSubmit={handleCreate}
            className="rounded-2xl p-5 border space-y-4"
            style={{ background: 'rgba(13,20,35,0.95)', borderColor: 'rgba(255,255,255,0.07)' }}
          >
            <h2 className="text-white font-black text-lg">Crear cuenta</h2>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                maxLength={32}
                className="w-full bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-yellow-500"
                placeholder="nuevo_usuario"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Nombre visible</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={48}
                className="w-full bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-yellow-500"
                placeholder="Jugador 1"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-yellow-500"
                placeholder="Minimo 6 caracteres"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full bg-slate-900/70 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-yellow-500"
              >
                <option value="player">player</option>
                <option value="admin">admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-xl font-black text-black disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              {busy ? 'Creando...' : 'Crear cuenta'}
            </button>

            {success && (
              <div className="text-green-300 text-sm rounded-lg px-3 py-2 border border-green-400/30 bg-green-500/10">
                {success}
              </div>
            )}
            {error && (
              <div className="text-red-300 text-sm rounded-lg px-3 py-2 border border-red-400/30 bg-red-500/10">
                {error}
              </div>
            )}
          </form>

          <div
            className="rounded-2xl p-5 border space-y-3"
            style={{ background: 'rgba(13,20,35,0.95)', borderColor: 'rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-white font-black text-lg">Cuentas</h2>
              <button
                onClick={loadUsers}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-white/15 text-slate-300 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                Recargar
              </button>
            </div>

            <div className="grid grid-cols-[1.3fr_1fr_0.8fr] gap-2 text-[11px] uppercase tracking-wider text-slate-500 px-2">
              <div>Usuario</div>
              <div>Creado</div>
              <div>Rol</div>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
              {loadingUsers && <div className="text-slate-500 text-sm py-6 text-center">Cargando usuarios...</div>}
              {!loadingUsers && users.length === 0 && (
                <div className="text-slate-500 text-sm py-6 text-center">No hay cuentas.</div>
              )}
              {!loadingUsers && users.map((user) => <UserRow key={user.id} user={user} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
