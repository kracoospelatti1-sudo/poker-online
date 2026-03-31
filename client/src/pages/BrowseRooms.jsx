import { useEffect, useState, useRef } from 'react'
import { socket } from '../socket.js'
import { hasAppliedPayment, markPaymentApplied } from '../utils/wallet.js'

const BLIND_LABELS = {
  'EASY01': { label: '🟢 Principiante', color: 'text-green-400', border: 'border-green-500/40', glow: 'rgba(34,197,94,0.15)' },
  'MED002': { label: '🟡 Intermedia',   color: 'text-yellow-400', border: 'border-yellow-500/40', glow: 'rgba(234,179,8,0.15)' },
  'HIGH03': { label: '🔴 Alta',          color: 'text-red-400',   border: 'border-red-500/40',   glow: 'rgba(239,68,68,0.15)' },
  'PRO004': { label: '💀 Pro',           color: 'text-purple-400', border: 'border-purple-500/40', glow: 'rgba(168,85,247,0.15)' },
}

const PHASE_LABELS = {
  WAITING: { text: 'Esperando', color: 'text-gray-400' },
  PREFLOP: { text: 'Pre-Flop',  color: 'text-blue-400' },
  FLOP:    { text: 'Flop',      color: 'text-cyan-400' },
  TURN:    { text: 'Turn',      color: 'text-orange-400' },
  RIVER:   { text: 'River',     color: 'text-red-400' },
  SHOWDOWN:{ text: 'Showdown',  color: 'text-yellow-400' },
}

const BASE_URL = window.location.origin
const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

function RoomCard({ room, profile, onJoin }) {
  const [copied, setCopied] = useState(false)
  const shareLink = `${BASE_URL}/sala/${room.code}`
  const handleShare = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  const meta = BLIND_LABELS[room.code]
  const phase = PHASE_LABELS[room.phase] || { text: room.phase, color: 'text-gray-400' }
  const isFull = room.playerCount + room.pendingCount >= room.maxPlayers
  const isPrivate = !room.isDefault
  const canJoin = !isFull
  const totalPlayers = room.playerCount + room.pendingCount

  const blindText = room.fixedBlinds
    ? `${room.fixedBlinds.sb}/${room.fixedBlinds.bb}`
    : '?/?'

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${canJoin ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-60 cursor-not-allowed'} ${meta?.border || 'border-slate-700/50'}`}
      style={{
        background: `linear-gradient(135deg, rgba(17,24,39,0.98) 0%, rgba(15,23,42,0.98) 100%)`,
        boxShadow: canJoin ? `0 0 20px ${meta?.glow || 'rgba(255,255,255,0.05)'}` : 'none'
      }}
      onClick={() => canJoin && onJoin(room.code)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="text-white font-black text-base sm:text-lg leading-tight truncate">{room.name}</h3>
          {room.desc && <p className="text-slate-500 text-xs mt-0.5 truncate">{room.desc}</p>}
        </div>
        <div className={`flex-shrink-0 text-xs font-black px-3 py-1 rounded-full border ${meta?.border || 'border-slate-600'} ${meta?.color || 'text-slate-300'}`}
          style={{ background: `${meta?.glow || 'rgba(255,255,255,0.05)'}` }}>
          {meta?.label || (isPrivate ? '🔒 Privada' : room.code)}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-mono font-black text-white">{blindText}</span>
          <span className="text-slate-600">blinds</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${room.phase === 'WAITING' ? 'bg-gray-500' : 'bg-green-400 animate-pulse'}`} />
          <span className={phase.color}>{phase.text}</span>
          {room.handCount > 0 && <span className="text-slate-600">#{room.handCount}</span>}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            {Array.from({ length: Math.min(totalPlayers, 6) }).map((_, i) => (
              <div key={i} className="w-5 h-5 rounded-full bg-slate-600 border border-slate-500 flex items-center justify-center text-[9px]">👤</div>
            ))}
            {totalPlayers === 0 && <span className="text-slate-600 text-xs">Sin jugadores</span>}
          </div>
          <span className="text-slate-400 text-xs">{totalPlayers}/{room.maxPlayers}</span>
          {room.pendingCount > 0 && <span className="text-blue-400 text-xs">(+{room.pendingCount} esperando)</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShare}
            className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all border"
            style={{
              background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
              borderColor: copied ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)',
              color: copied ? '#4ade80' : '#64748b'
            }}>
            {copied ? '✓' : '🔗'}
          </button>
          <div className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
            isFull
              ? 'bg-slate-700/50 text-slate-500'
              : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
          }`}>
            {isFull ? 'Llena' : room.phase === 'WAITING' ? 'Unirse →' : 'Sentar →'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BrowseRooms({ profile, walletId, setMyId, setRoomData, setScreen, onChipsChange, onBack, autoJoinCode }) {
  const [rooms, setRooms] = useState([])
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [coinPacks, setCoinPacks] = useState([])
  const [buyingPackId, setBuyingPackId] = useState('')
  const [tab, setTab] = useState('default') // 'default' | 'private' | 'bots'
  const [botCount, setBotCount] = useState(3)
  const codeRef = useRef(null)
  const getCurrentChips = () => {
    const raw = parseInt(localStorage.getItem('poker_chips'), 10)
    if (Number.isFinite(raw) && raw > 0) return raw
    return profile.chips || 1500
  }

  useEffect(() => {
    let cancelled = false
    fetch(`${API_URL}/api/coin-packs`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setCoinPacks(Array.isArray(data?.packs) ? data.packs : [])
      })
      .catch(() => {
        if (cancelled) return
        setCoinPacks([])
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mpStatus = params.get('mp_status')
    const paymentId = params.get('payment_id')
    const shouldCleanUrl = mpStatus || paymentId
    if (!shouldCleanUrl) return

    let cancelled = false
    const cleanPaymentParamsFromUrl = () => {
      const nextParams = new URLSearchParams(window.location.search)
      ;['mp_status', 'payment_id', 'status', 'merchant_order_id', 'preference_id', 'collection_id', 'collection_status']
        .forEach(k => nextParams.delete(k))
      const nextSearch = nextParams.toString()
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`
      window.history.replaceState({}, '', nextUrl)
    }

    const confirmPayment = async () => {
      if (mpStatus !== 'success' || !paymentId) {
        if (mpStatus === 'pending') setPaymentStatus('Pago pendiente. Cuando se apruebe, las fichas se acreditan.')
        if (mpStatus === 'failure') setPaymentStatus('Pago no completado.')
        cleanPaymentParamsFromUrl()
        return
      }

      if (hasAppliedPayment(paymentId)) {
        setPaymentStatus('Este pago ya estaba acreditado en este navegador.')
        cleanPaymentParamsFromUrl()
        return
      }

      try {
        const response = await fetch(`${API_URL}/api/payments/confirm?payment_id=${encodeURIComponent(paymentId)}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error || 'No se pudo validar el pago')
        if (data.walletId !== walletId) throw new Error('El pago pertenece a otra wallet')

        const current = getCurrentChips()
        const credited = Number(data.chips) || 0
        if (credited > 0) {
          onChipsChange(current + credited)
          markPaymentApplied(paymentId)
          if (!cancelled) setPaymentStatus(`Pago aprobado: +${credited.toLocaleString()} fichas.`)
        }
      } catch (e) {
        if (!cancelled) setPaymentStatus(e?.message || 'No se pudo acreditar el pago.')
      } finally {
        cleanPaymentParamsFromUrl()
      }
    }

    confirmPayment()
    return () => { cancelled = true }
  }, [walletId, onChipsChange])

  useEffect(() => {
    const onRoomList = (list) => setRooms(list)
    const onRoomCreated = (data) => {
      setMyId(socket.id)
      setRoomData(data)
      setScreen('waiting')
      setJoining(false)
    }
    const onRoomJoined = (data) => {
      setMyId(socket.id)
      setRoomData(data)
      setScreen(data.isBotRoom || data.isPending ? 'game' : 'waiting')
      setJoining(false)
    }
    const onJoinError = (msg) => {
      setError(msg)
      setJoining(false)
    }

    const joinLobby = () => {
      socket.emit('join_lobby')
      if (autoJoinCode) handleJoinRoom(autoJoinCode)
    }

    socket.on('room_list', onRoomList)
    socket.on('room_created', onRoomCreated)
    socket.on('room_joined', onRoomJoined)
    socket.on('join_error', onJoinError)
    socket.on('connect', joinLobby)

    // If already connected, join immediately too
    if (socket.connected) joinLobby()

    return () => {
      socket.emit('leave_lobby')
      socket.off('room_list', onRoomList)
      socket.off('room_created', onRoomCreated)
      socket.off('room_joined', onRoomJoined)
      socket.off('join_error', onJoinError)
      socket.off('connect', joinLobby)
    }
  }, [])

  const handleJoinRoom = (code) => {
    if (joining) return
    setJoining(true)
    setError('')
    socket.emit('join_room', { name: profile.name, emoji: profile.emoji, chips: profile.chips || 1500, code: code.toUpperCase() })
  }

  const handleCreateRoom = () => {
    if (joining) return
    setJoining(true)
    setError('')
    socket.emit('create_room', { name: profile.name, emoji: profile.emoji, chips: profile.chips || 1500 })
  }

  const handleCreateBotRoom = () => {
    if (joining) return
    setJoining(true)
    setError('')
    socket.emit('create_bot_room', {
      name: profile.name,
      emoji: profile.emoji,
      chips: profile.chips || 1500,
      botCount,
    })
  }

  const handleBuyChips = async (packId) => {
    if (!walletId || buyingPackId) return
    setBuyingPackId(packId)
    setPaymentStatus('')

    try {
      const response = await fetch(`${API_URL}/api/payments/create-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, packId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'No se pudo iniciar el checkout')
      const checkoutUrl = data.checkoutUrl || data.sandboxCheckoutUrl
      if (!checkoutUrl) throw new Error('Mercado Pago no devolvio URL de checkout')
      window.location.href = checkoutUrl
    } catch (e) {
      setPaymentStatus(e?.message || 'No se pudo iniciar la compra de fichas.')
      setBuyingPackId('')
    }
  }

  const defaultRooms = rooms.filter(r => r.isDefault)
  const privateRooms = rooms.filter(r => !r.isDefault)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0a0f1a 0%, #0f172a 50%, #0a1628 100%)' }}>

      {/* Decorative suit symbols */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none">
        {['♠','♥','♦','♣'].map((s, i) => (
          <div key={s} className="absolute text-white/[0.02] font-black"
            style={{ fontSize: '22rem', top: `${[5,-8,45,50][i]}%`, left: `${[-5,65,-8,72][i]}%`, transform: 'rotate(-15deg)' }}>
            {s}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-slate-700/50 px-4 py-4"
        style={{ background: 'rgba(10,15,26,0.95)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors p-2 rounded-xl hover:bg-slate-700/50">
            ← Volver
          </button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-yellow-400 text-2xl">♠</span>
            <h1 className="font-display text-2xl tracking-wider text-white">Salas de Juego</h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 border"
            style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
            <span className="text-base">{profile.emoji}</span>
            <span className="text-white font-bold text-sm truncate max-w-[60px]">{profile.name}</span>
            <div className="w-px h-4 bg-white/10 mx-0.5"/>
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <defs>
                <radialGradient id="hcg" cx="38%" cy="32%" r="65%">
                  <stop offset="0%" stopColor="#fde68a"/>
                  <stop offset="100%" stopColor="#92400e"/>
                </radialGradient>
              </defs>
              <circle cx="16" cy="16" r="14" fill="url(#hcg)" stroke="#78350f" strokeWidth="1"/>
              <circle cx="16" cy="16" r="11" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
              <text x="16" y="21" textAnchor="middle" fontSize="11" fontWeight="900"
                fontFamily="Georgia,serif" fill="#7c2d12">$</text>
            </svg>
            <span className="text-yellow-400 font-bold text-sm font-mono">
              {(profile.chips || 1500).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative z-10 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">

        {/* Chip store */}
        <div className="rounded-2xl border border-emerald-500/30 p-4 sm:p-5"
          style={{ background: 'linear-gradient(135deg, rgba(6,78,59,0.22), rgba(4,120,87,0.15))' }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-white font-black text-sm sm:text-base">Cargar fichas</h2>
              <p className="text-emerald-200/70 text-xs">Checkout seguro con Mercado Pago</p>
            </div>
            <div className="text-emerald-300 text-xs font-mono">Wallet {walletId?.slice(0, 8)}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {coinPacks.map(pack => (
              <button key={pack.id}
                onClick={() => handleBuyChips(pack.id)}
                disabled={!!buyingPackId}
                className="rounded-xl border border-emerald-400/30 p-3 text-left transition-all hover:border-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-white font-bold text-sm">{pack.label}</div>
                <div className="text-emerald-300 font-black text-base">{Number(pack.chips || 0).toLocaleString()} fichas</div>
                <div className="text-emerald-200/80 text-xs mt-1">${Number(pack.price || 0).toLocaleString('es-AR')} {pack.currency || 'ARS'}</div>
              </button>
            ))}
            {coinPacks.length === 0 && (
              <div className="text-slate-400 text-sm py-2">No hay paquetes configurados.</div>
            )}
          </div>

          {paymentStatus && (
            <div className="mt-3 text-xs sm:text-sm rounded-lg border border-emerald-400/25 px-3 py-2 text-emerald-200"
              style={{ background: 'rgba(16,185,129,0.08)' }}>
              {paymentStatus}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl border border-slate-700/50 p-1 gap-1" style={{ background: 'rgba(17,24,39,0.8)' }}>
          {[
            { key: 'default', label: '🎰 Oficiales' },
            { key: 'bots',    label: '🤖 Bots' },
            { key: 'private', label: '🔒 Privadas' + (privateRooms.length > 0 ? ` (${privateRooms.length})` : '') }
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                tab === key
                  ? 'text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={tab === key ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)' } : {}}>
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm text-center rounded-xl py-3 px-4">
            {error}
          </div>
        )}

        {/* Default rooms tab */}
        {tab === 'default' && (
          <div className="space-y-3">
            {defaultRooms.length === 0 ? (
              <div className="text-center text-slate-500 py-12">Cargando mesas...</div>
            ) : (
              defaultRooms.map(room => (
                <RoomCard key={room.code} room={room} profile={profile} onJoin={handleJoinRoom} />
              ))
            )}
          </div>
        )}

        {/* Bots tab */}
        {tab === 'bots' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-700/50 p-6 space-y-6"
              style={{ background: 'rgba(17,24,39,0.95)' }}>

              {/* Header */}
              <div className="text-center">
                <div className="text-5xl mb-3">🤖</div>
                <h2 className="text-white font-black text-xl">Jugar contra Bots</h2>
                <p className="text-slate-500 text-sm mt-1">Los bots juegan bien — ¡no te confíes!</p>
                <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full border border-emerald-500/30 text-xs font-bold text-emerald-400"
                  style={{ background: 'rgba(16,185,129,0.08)' }}>
                  ✓ Sin descuento de fichas reales
                </div>
              </div>

              {/* Bot count picker */}
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-3 text-center">
                  Cantidad de Bots
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setBotCount(n)}
                      className={`w-12 h-12 rounded-xl font-black text-lg transition-all active:scale-95 border ${
                        botCount === n
                          ? 'border-yellow-500 text-black scale-110'
                          : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-white'
                      }`}
                      style={botCount === n ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)' } : { background: 'rgba(255,255,255,0.04)' }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bot previews */}
              <div className="flex justify-center gap-2 flex-wrap">
                {[
                  { emoji: '🤖', name: 'RoboCop', style: 'TAG' },
                  { emoji: '🦾', name: 'DeepBlue', style: 'GTO' },
                  { emoji: '🧠', name: 'Magnus',   style: 'LAG' },
                  { emoji: '👾', name: 'Matrix',   style: 'Shark' },
                  { emoji: '⚡', name: 'Nexus',    style: 'GTO' },
                ].slice(0, botCount).map((bot, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border border-slate-700/50"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="text-2xl">{bot.emoji}</span>
                    <span className="text-white text-xs font-bold">{bot.name}</span>
                    <span className="text-slate-500 text-[10px]">{bot.style}</span>
                  </div>
                ))}
              </div>

              {/* Start button */}
              <button onClick={handleCreateBotRoom} disabled={joining}
                className="w-full py-4 rounded-xl font-display text-2xl tracking-widest transition-all active:scale-95 text-black relative overflow-hidden group disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 60%, #b45309 100%)',
                  boxShadow: '0 0 30px rgba(245,158,11,0.35), 0 4px 15px rgba(0,0,0,0.3)'
                }}>
                <span className="relative z-10">{joining ? 'Creando...' : `Jugar vs ${botCount} Bot${botCount > 1 ? 's' : ''} →`}</span>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }}/>
              </button>
            </div>
          </div>
        )}

        {/* Private rooms tab */}
        {tab === 'private' && (
          <div className="space-y-4">
            {/* Join by code */}
            <div className="rounded-2xl border border-slate-700/50 p-5 space-y-3"
              style={{ background: 'rgba(17,24,39,0.95)' }}>
              <h3 className="text-white font-black text-sm uppercase tracking-widest">Unirse con código</h3>
              <div className="flex gap-2">
                <input
                  ref={codeRef}
                  type="text"
                  value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && joinCode.length >= 4 && handleJoinRoom(joinCode)}
                  placeholder="Ej: ABC123"
                  maxLength={8}
                  className="flex-1 bg-slate-800/80 border border-slate-600/50 text-white rounded-xl px-4 py-3 font-mono text-lg font-black tracking-widest outline-none focus:border-yellow-500 transition-colors placeholder-slate-600 text-center uppercase"
                  autoFocus
                />
                <button
                  onClick={() => joinCode.trim() && handleJoinRoom(joinCode)}
                  disabled={joinCode.trim().length < 4 || joining}
                  className="px-5 py-3 rounded-xl font-black text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  {joining ? '...' : '→'}
                </button>
              </div>
            </div>

            {/* Create room */}
            <button
              onClick={handleCreateRoom}
              disabled={joining}
              className="w-full rounded-2xl border border-slate-700/50 p-5 text-left hover:border-yellow-500/40 transition-all group disabled:opacity-50"
              style={{ background: 'rgba(17,24,39,0.95)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400 text-xl group-hover:scale-110 transition-transform">+</div>
                <div>
                  <div className="text-white font-black">Crear sala privada</div>
                  <div className="text-slate-500 text-xs">Invitá a tus amigos con un código</div>
                </div>
                <div className="ml-auto text-yellow-400 text-lg group-hover:translate-x-1 transition-transform">→</div>
              </div>
            </button>

            {/* Private rooms list */}
            {privateRooms.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Salas activas</h3>
                {privateRooms.map(room => (
                  <RoomCard key={room.code} room={room} profile={profile} onJoin={handleJoinRoom} />
                ))}
              </div>
            )}

            {privateRooms.length === 0 && (
              <div className="text-center text-slate-600 py-6 text-sm">No hay salas privadas activas</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
