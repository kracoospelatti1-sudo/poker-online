import { useState } from 'react'

const EMOJIS = ['🐯', '🦊', '🐻', '🦁', '🐺', '🦈', '🐸', '🦅', '🦄', '🐲']
const STARTING_CHIPS = 1500

function CoinIcon({ size = 32 }) {
  const id = `cg_${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={id} cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#fde68a"/>
          <stop offset="45%" stopColor="#f59e0b"/>
          <stop offset="100%" stopColor="#92400e"/>
        </radialGradient>
        <filter id={`shadow_${size}`}>
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#78350f" floodOpacity="0.5"/>
        </filter>
      </defs>
      <circle cx="16" cy="16" r="14.5" fill={`url(#${id})`} stroke="#78350f" strokeWidth="1" filter={`url(#shadow_${size})`}/>
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
      <text x="16" y="21" textAnchor="middle" fontSize="12" fontWeight="900"
        fontFamily="Georgia,serif" fill="#7c2d12" letterSpacing="-0.5">$</text>
      {/* Shine */}
      <ellipse cx="12" cy="10" rx="4" ry="2.5" fill="rgba(255,255,255,0.3)" transform="rotate(-30 12 10)"/>
    </svg>
  )
}

export default function Lobby({ onProfileSet, pendingRoomCode }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [error, setError] = useState('')

  const storedChips = (() => {
    const v = parseInt(localStorage.getItem('poker_chips'), 10)
    return !isNaN(v) && v > 0 ? v : STARTING_CHIPS
  })()

  const isNewPlayer = storedChips === STARTING_CHIPS && !localStorage.getItem('poker_chips')

  const handleContinue = () => {
    if (!name.trim()) { setError('Ingresá tu apodo'); return }
    onProfileSet({ name: name.trim(), emoji })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #050d1a 0%, #0a1628 45%, #070f1e 100%)' }}>

      {/* Animated background suits */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {['♠','♥','♦','♣'].map((s, i) => (
          <div key={s} className="absolute font-black opacity-[0.035]"
            style={{
              fontSize: '22rem',
              top: `${[8,-6,38,52][i]}%`,
              left: `${[-6,68,-8,73][i]}%`,
              transform: 'rotate(-15deg)',
              color: i === 1 || i === 2 ? '#ef4444' : '#fff',
              filter: 'blur(1px)'
            }}>
            {s}
          </div>
        ))}
        {/* Subtle radial glow */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.04) 0%, transparent 70%)'
        }}/>
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-1">
            <span className="text-red-500 text-4xl" style={{ textShadow: '0 0 20px rgba(239,68,68,0.5)' }}>♥</span>
            <h1 className="font-display text-6xl tracking-wider"
              style={{ color: '#f59e0b', textShadow: '0 0 40px rgba(245,158,11,0.5), 0 2px 0 rgba(0,0,0,0.5)' }}>
              POKER
            </h1>
            <span className="text-slate-300 text-4xl" style={{ textShadow: '0 0 20px rgba(255,255,255,0.1)' }}>♠</span>
          </div>
          <p className="text-slate-500 text-xs tracking-[0.3em] uppercase">Texas Hold'em Online</p>
        </div>

        {/* Chip Balance */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(180,83,9,0.05))',
              borderColor: 'rgba(245,158,11,0.25)',
              boxShadow: '0 0 20px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.05)'
            }}>
            <CoinIcon size={30} />
            <div>
              <div className="text-yellow-400 font-display text-2xl tracking-wider leading-none">
                {storedChips.toLocaleString()}
              </div>
              <div className="text-yellow-700 text-[10px] uppercase tracking-widest font-semibold">
                {isNewPlayer ? 'fichas iniciales' : 'tus fichas'}
              </div>
            </div>
            {storedChips > STARTING_CHIPS && (
              <div className="ml-1 text-green-400 text-xs font-bold bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                +{(storedChips - STARTING_CHIPS).toLocaleString()}
              </div>
            )}
            {storedChips < STARTING_CHIPS && storedChips > 0 && (
              <div className="ml-1 text-red-400 text-xs font-bold bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
                -{(STARTING_CHIPS - storedChips).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-2xl p-6 space-y-5 border"
          style={{
            background: 'rgba(13,20,35,0.95)',
            borderColor: 'rgba(255,255,255,0.07)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)'
          }}>

          {/* Avatar */}
          <div>
            <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-3">
              Elegí tu avatar
            </label>
            <div className="grid grid-cols-5 gap-2">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={`text-2xl h-12 rounded-xl transition-all duration-150 ${
                    emoji === e
                      ? 'scale-110 border-2 border-yellow-500'
                      : 'border border-white/10 hover:border-white/25 hover:scale-105'
                  }`}
                  style={{
                    background: emoji === e
                      ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(180,83,9,0.1))'
                      : 'rgba(255,255,255,0.04)',
                    boxShadow: emoji === e ? '0 0 12px rgba(245,158,11,0.3)' : 'none'
                  }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
              Tu apodo
            </label>
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 border transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.6)'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
              <span className="text-2xl flex-shrink-0">{emoji}</span>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleContinue()}
                placeholder="Ej: El Tigre"
                maxLength={16}
                className="flex-1 bg-transparent text-white outline-none placeholder-slate-600 text-base font-semibold"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center py-2 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {pendingRoomCode && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 border border-blue-500/30 text-sm"
              style={{ background: 'rgba(30,64,175,0.12)' }}>
              <span className="text-blue-400 text-base">🔗</span>
              <span className="text-blue-300">Vas a unirte a la sala <span className="font-mono font-black text-white">{pendingRoomCode}</span></span>
            </div>
          )}

          <button onClick={handleContinue}
            className="w-full py-4 rounded-xl font-display text-2xl tracking-widest transition-all active:scale-95 text-black relative overflow-hidden group"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 60%, #b45309 100%)',
              boxShadow: '0 0 30px rgba(245,158,11,0.35), 0 4px 15px rgba(0,0,0,0.3)'
            }}>
            <span className="relative z-10">Ver Salas →</span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }}/>
          </button>
        </div>
      </div>
    </div>
  )
}
