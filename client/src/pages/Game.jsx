import { useEffect, useState, useRef, useCallback } from 'react'
import { socket } from '../socket.js'
import { sounds } from '../utils/sounds.js'
import { calculateEquity } from '../utils/equity.js'
import { evaluateBestHand } from '../utils/handEval.js'

const BLIND_LEVELS = [
  { sb: 10, bb: 20 }, { sb: 20, bb: 40 }, { sb: 50, bb: 100 },
  { sb: 100, bb: 200 }, { sb: 200, bb: 400 }, { sb: 500, bb: 1000 }, { sb: 1000, bb: 2000 }
]
const TURN_SECONDS = 30

const POS = [
  'bottom-[-50px] left-1/2 -translate-x-1/2',
  'bottom-[5%] left-[-10px] sm:left-[20px]',
  'top-[5%] left-[-10px] sm:left-[20px]',
  'top-[-40px] left-1/2 -translate-x-1/2',
  'top-[5%] right-[-10px] sm:right-[20px]',
  'bottom-[5%] right-[-10px] sm:right-[20px]'
]

const isRed = s => s === 'â™¥' || s === 'â™¦'

// SVG card back â€” classic navy diamond pattern
function CardBack({ w, h, rx }) {
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="dp" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#1e3a5f"/>
          <path d="M5 0 L10 5 L5 10 L0 5 Z" fill="#1a3354" opacity="0.7"/>
          <path d="M5 2 L8 5 L5 8 L2 5 Z" fill="#2563ab" opacity="0.4"/>
        </pattern>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.08"/>
          <stop offset="50%" stopColor="white" stopOpacity="0"/>
          <stop offset="100%" stopColor="white" stopOpacity="0.04"/>
        </linearGradient>
      </defs>
      <rect width={w} height={h} rx={rx} fill="#1e3a5f"/>
      <rect x="3" y="3" width={w-6} height={h-6} rx={rx-1} fill="url(#dp)"/>
      <rect x="3" y="3" width={w-6} height={h-6} rx={rx-1} fill="none" stroke="#3b82f6" strokeWidth="0.5" opacity="0.4"/>
      <rect width={w} height={h} rx={rx} fill="url(#sheen)"/>
    </svg>
  )
}

// SVG face card
function CardFace({ card, w, h, rx, small }) {
  const red = isRed(card.suit)
  const color = red ? '#dc2626' : '#1e293b'
  const fs = small ? 10 : 14
  const ss = small ? 11 : 18
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`cg${card.value}${card.suit}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#f8fafc"/>
        </linearGradient>
        <filter id="cs">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15"/>
        </filter>
      </defs>
      <rect width={w} height={h} rx={rx} fill={`url(#cg${card.value}${card.suit})`} stroke="#e2e8f0" strokeWidth="0.8" filter="url(#cs)"/>
      {/* Top-left corner */}
      <text x="4" y={fs+2} fontSize={fs} fontWeight="900" fontFamily="Georgia,serif" fill={color}>{card.value}</text>
      <text x="4" y={fs*2+2} fontSize={fs-2} fontFamily="Georgia,serif" fill={color}>{card.suit}</text>
      {/* Center */}
      <text x={w/2} y={h/2+ss/3} fontSize={ss} fontFamily="Georgia,serif" fill={color} textAnchor="middle" dominantBaseline="middle">{card.suit}</text>
      {/* Bottom-right (rotated 180Â°) */}
      <g transform={`rotate(180, ${w/2}, ${h/2})`}>
        <text x="4" y={fs+2} fontSize={fs} fontWeight="900" fontFamily="Georgia,serif" fill={color}>{card.value}</text>
        <text x="4" y={fs*2+2} fontSize={fs-2} fontFamily="Georgia,serif" fill={color}>{card.suit}</text>
      </g>
    </svg>
  )
}

function Card({ card, hidden = false, small = false }) {
  const w = small ? 40 : 56
  const h = small ? 56 : 80
  const rx = 5

  if (hidden) return (
    <div className="flex-shrink-0 drop-shadow-lg">
      <CardBack w={w} h={h} rx={rx} />
    </div>
  )
  if (!card) return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <rect width={w} height={h} rx={rx} fill="none" stroke="rgba(34,197,94,0.25)" strokeWidth="1.5" strokeDasharray="4 3"/>
    </svg>
  )

  return (
    <div className="flex-shrink-0 drop-shadow-lg hover:drop-shadow-xl transition-all duration-150 hover:-translate-y-0.5">
      <CardFace card={card} w={w} h={h} rx={rx} small={small} />
    </div>
  )
}

function TimerRing({ timeLeft, total = TURN_SECONDS }) {
  const pct = Math.max(0, timeLeft / total)
  const r = 16, circ = 2 * Math.PI * r
  const danger = timeLeft <= 8
  const warn = timeLeft <= 15

  return (
    <div className={`relative w-10 h-10 flex items-center justify-center ${danger ? 'animate-pulse' : ''}`}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3"/>
        <circle cx="20" cy="20" r={r} fill="none"
          stroke={danger ? '#ef4444' : warn ? '#f59e0b' : '#22c55e'}
          strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s linear' }}
        />
      </svg>
      <span className={`text-[11px] font-black ${danger ? 'text-red-400' : warn ? 'text-yellow-400' : 'text-green-400'}`}>
        {timeLeft}
      </span>
    </div>
  )
}

function actionColor(action) {
  if (!action) return 'bg-black/80 text-white border-white/10'
  if (action.includes('No va')) return 'bg-red-900/90 text-red-100 border-red-500'
  if (action.includes('Sube') || action.includes('All-In') || action.includes('Ciega')) return 'bg-green-900/90 text-green-100 border-green-500'
  if (action.includes('Iguala') || action.includes('Pasa')) return 'bg-blue-900/90 text-blue-100 border-blue-500'
  return 'bg-black/80 text-white border-white/10'
}

function EquityBadge({ win, tie }) {
  if (win == null) return null
  const color = win >= 60 ? 'text-green-400' : win >= 35 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-1 bg-black/70 border border-white/20 rounded-full px-2 py-0.5 text-[10px] font-bold">
      <span className={color}>{win}%</span>
      {tie > 0 && <span className="text-gray-400">/ {tie}% ðŸ¤</span>}
    </div>
  )
}

function TournamentEndScreen({ players, onRestart }) {
  const sorted = [...players].sort((a, b) => b.chips - a.chips)
  const medals = ['ðŸ¥‡', 'ðŸ¥ˆ', 'ðŸ¥‰']

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-yellow-500/30 rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">ðŸ†</div>
          <h2 className="text-3xl font-black text-yellow-400">Torneo Finalizado</h2>
        </div>
        <div className="space-y-2 mb-6">
          {sorted.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${i === 0 ? 'bg-yellow-900/30 border border-yellow-500/40' : 'bg-zinc-800'}`}>
              <span className="text-2xl">{medals[i] || `#${i+1}`}</span>
              <span className="text-xl">{p.emoji}</span>
              <span className="font-bold text-white flex-1">{p.name}</span>
              <span className={`font-mono font-bold ${p.chips > 0 ? 'text-green-400' : 'text-red-400'}`}>${p.chips}</span>
            </div>
          ))}
        </div>
        <button onClick={onRestart} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-widest">
          Nueva Partida
        </button>
      </div>
    </div>
  )
}

function WaitingRoom({ lobby, myId, onStart, onLeave }) {
  const isHost = lobby?.hostId === myId
  const copy = () => navigator.clipboard.writeText(lobby?.code || '')
  const [copied, setCopied] = useState(false)
  const handleCopy = () => { copy(); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0a0f1a 0%, #0f172a 50%, #0a1628 100%)' }}>
      {/* Decorative */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {['â™ ','â™¥','â™¦','â™£'].map((s, i) => (
          <div key={s} className="absolute text-white/[0.025] font-black"
            style={{ fontSize: '20rem', top: `${[10,-5,40,55][i]}%`, left: `${[-8,70,-10,75][i]}%`, transform: 'rotate(-15deg)' }}>
            {s}
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-1">
            <span className="text-red-400 text-3xl">â™¥</span>
            <h1 className="text-4xl font-black tracking-tight" style={{ color: '#f59e0b', textShadow: '0 0 30px rgba(245,158,11,0.4)' }}>POKER</h1>
            <span className="text-slate-400 text-3xl">â™ </span>
          </div>
          <p className="text-slate-500 text-xs tracking-widest uppercase">Sala de Espera</p>
        </div>

        <div className="rounded-2xl p-6 space-y-5 border border-slate-700/50 shadow-2xl"
          style={{ background: 'rgba(17,24,39,0.97)', backdropFilter: 'blur(20px)' }}>

          <div className="text-center">
            <div className="text-slate-500 text-xs uppercase tracking-widest mb-2">CÃ³digo de sala</div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-yellow-400 font-mono text-3xl font-black tracking-[0.3em]">{lobby?.code}</span>
              <button onClick={handleCopy} className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all"
                style={{ background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(71,85,105,0.5)', color: copied ? '#4ade80' : '#94a3b8', border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(71,85,105,0.5)'}` }}>
                {copied ? 'âœ“ Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="text-slate-600 text-xs mt-1">CompartÃ­ el cÃ³digo con tus amigos</p>
          </div>

          <div>
            <div className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-3">
              Jugadores ({lobby?.players?.length || 0}/6)
            </div>
            <div className="space-y-2">
              {lobby?.players?.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl px-4 py-2.5 border border-slate-700/50"
                  style={{ background: 'rgba(30,41,59,0.7)' }}>
                  <span className="text-xl">{p.emoji || 'ðŸŽ´'}</span>
                  <span className="text-white font-bold text-sm truncate flex-1">{p.name}</span>
                  {p.id === lobby.hostId && <span className="text-yellow-500 text-[10px] font-black border border-yellow-500/40 px-2 py-0.5 rounded-full bg-yellow-500/10">HOST</span>}
                  {p.id === myId && p.id !== lobby.hostId && <span className="text-blue-400 text-[10px] border border-blue-400/40 px-2 py-0.5 rounded-full bg-blue-400/10">TÃº</span>}
                </div>
              ))}
            </div>
          </div>

          {isHost ? (
            <button onClick={onStart} disabled={(lobby?.players?.length || 0) < 2}
              className="w-full py-4 rounded-xl font-black text-lg uppercase tracking-widest transition-all active:scale-95 text-black disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 30px rgba(245,158,11,0.3)' }}>
              {(lobby?.players?.length || 0) < 2 ? 'Esperando jugadores...' : 'Â¡Empezar Partida!'}
            </button>
          ) : (
            <div className="text-center text-slate-500 text-sm py-2 border border-slate-700/50 rounded-xl"
              style={{ background: 'rgba(30,41,59,0.4)' }}>
              Esperando que el host empiece...
            </div>
          )}

          <button
            onClick={onLeave}
            className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-95 text-slate-200 border border-slate-600 hover:border-red-500/60 hover:text-red-300"
            style={{ background: 'rgba(15,23,42,0.7)' }}>
            Salir de la sala
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Game({ screen, setScreen, roomData, setRoomData, myId, saveChips, isBotRoom }) {
  const [lobby, setLobby] = useState(roomData)
  const [gs, setGs] = useState(null)
  const [myCards, setMyCards] = useState([])
  const [customRaise, setCustomRaise] = useState(20)
  const [timer, setTimer] = useState({ timeLeft: 0, playerId: null })
  const [equity, setEquity] = useState(null)
  const [showLog, setShowLog] = useState(false)
  // Animation state
  const [boardFlipKey, setBoardFlipKey] = useState(0)
  const [holeFlipKey, setHoleFlipKey] = useState(0)
  const [flyingChips, setFlyingChips] = useState([])
  const [potKey, setPotKey] = useState(0)
  const logsEndRef = useRef(null)
  const prevPhaseRef = useRef(null)
  const prevTurnRef = useRef(null)
  const prevWinnersRef = useRef([])
  const prevBoardLenRef = useRef(0)
  const prevRoundBetsRef = useRef({})
  const prevPotRef = useRef(0)
  const playerSeatRefs = useRef({})
  const potRef = useRef(null)

  const requestLeaveRoom = useCallback(() => {
    const ok = window.confirm('Â¿Seguro que querÃ©s salir de la sala?')
    if (!ok) return
    socket.emit('leave_room')
  }, [])

  // Sounds on events
  useEffect(() => {
    if (!gs) return
    const prevPhase = prevPhaseRef.current
    const prevTurn = prevTurnRef.current
    const prevWinners = prevWinnersRef.current

    if (gs.phase !== prevPhase) {
      if (gs.phase === 'FLOP' || gs.phase === 'TURN' || gs.phase === 'RIVER') sounds.card()
      if (gs.phase === 'PREFLOP' && prevPhase === 'SHOWDOWN') sounds.newHand()
      if (gs.phase === 'SHOWDOWN' && gs.winners?.length > 0) {
        if (gs.winners.includes(myId)) sounds.win()
      }
    }
    if (gs.turnIdx !== prevTurn && gs.phase !== 'SHOWDOWN' && gs.phase !== 'WAITING') {
      sounds.card()
    }

    prevPhaseRef.current = gs.phase
    prevTurnRef.current = gs.turnIdx
    prevWinnersRef.current = gs.winners || []
  }, [gs, myId])

  // Save chips on game finish (skip for bot rooms)
  useEffect(() => {
    if (gs?.phase === 'FINISHED' && myId && saveChips && !isBotRoom) {
      const me = gs.players.find(p => p.id === myId)
      const finalChips = me?.chips ?? 0
      saveChips(finalChips > 0 ? finalChips : 1500)
    }
  }, [gs?.phase])

  // Timer sounds
  useEffect(() => {
    if (timer.playerId === myId) {
      if (timer.timeLeft <= 8 && timer.timeLeft > 0) sounds.warn()
      else if (timer.timeLeft <= 15 && timer.timeLeft > 8) sounds.tick()
    }
  }, [timer.timeLeft])

  // Equity calculation
  useEffect(() => {
    if (!gs || !myCards.length || gs.phase === 'SHOWDOWN' || gs.phase === 'WAITING' || gs.phase === 'FINISHED') {
      setEquity(null); return
    }
    const opponents = gs.players.filter(p => p.id !== myId && (p.status === 'ACTIVE' || p.status === 'ALL_IN')).length
    if (opponents === 0) { setEquity(null); return }
    const result = calculateEquity(myCards, gs.board || [], opponents, 220)
    setEquity(result)
  }, [myCards, gs?.board?.length, gs?.phase])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [gs?.logs])

  // Clean up flying chips after animation
  useEffect(() => {
    if (flyingChips.length === 0) return
    const t = setTimeout(() => setFlyingChips(c => c.slice(1)), 700)
    return () => clearTimeout(t)
  }, [flyingChips.length])

  useEffect(() => {
    const onRoomUpdated = (data) => setLobby(prev => ({ ...prev, ...data }))
    const onGameState = (state) => {
      setGs(prev => {
        // Detect new board cards â†’ trigger flip
        if ((state.board?.length || 0) > prevBoardLenRef.current) {
          setBoardFlipKey(k => k + 1)
        }
        prevBoardLenRef.current = state.board?.length || 0
        if (state.phase === 'PREFLOP' || state.phase === 'WAITING') {
          prevBoardLenRef.current = 0
          prevRoundBetsRef.current = {}
        }

        // Detect chip bets â†’ fly chips to pot
        const potEl = potRef.current
        if (potEl && state.players) {
          const potRect = potEl.getBoundingClientRect()
          const potCx = potRect.left + potRect.width / 2
          const potCy = potRect.top + potRect.height / 2
          const newChips = []
          state.players.forEach(p => {
            const prevBet = prevRoundBetsRef.current[p.id] ?? 0
            if (p.roundBet > prevBet && playerSeatRefs.current[p.id]) {
              const sr = playerSeatRefs.current[p.id].getBoundingClientRect()
              const sx = sr.left + sr.width / 2
              const sy = sr.top + sr.height / 2
              newChips.push({ id: `${p.id}-${Date.now()}`, x: sx - 11, y: sy - 11, tx: potCx - sx, ty: potCy - sy })
            }
            prevRoundBetsRef.current[p.id] = p.roundBet
          })
          if (newChips.length) setFlyingChips(c => [...c, ...newChips])
        }

        // Pot pulse
        if ((state.pot || 0) > prevPotRef.current) setPotKey(k => k + 1)
        prevPotRef.current = state.pot || 0

        return state
      })
      if (!['WAITING', 'FINISHED'].includes(state.phase)) setScreen('game')
      const bb = (state.fixedBlinds?.bb) || BLIND_LEVELS[state.blindLevel]?.bb || 20
      setCustomRaise(r => Math.max(r, bb))
    }
    const onYourCards = (cards) => {
      setMyCards(cards)
      if (cards.length > 0) { sounds.card(); setHoleFlipKey(k => k + 1) }
    }
    const onTimer = (data) => setTimer(data)
    const onError = (msg) => alert(msg)
    const onBotGameOver = ({ message }) => {
      alert(message || 'Partida vs bots terminada.')
      setRoomData(null)
      setScreen('browse')
    }
    const onRoomLeft = () => {
      setGs(null)
      setMyCards([])
      setLobby(null)
      setRoomData(null)
      setScreen('browse')
    }

    socket.on('room_updated', onRoomUpdated)
    socket.on('game_state', onGameState)
    socket.on('your_cards', onYourCards)
    socket.on('turn_timer', onTimer)
    socket.on('join_error', onError)
    socket.on('bot_game_over', onBotGameOver)
    socket.on('room_left', onRoomLeft)

    // Re-request state on mount (handles joining mid-game where event arrived before listeners registered)
    socket.emit('get_game_state')

    return () => {
      socket.off('room_updated', onRoomUpdated)
      socket.off('game_state', onGameState)
      socket.off('your_cards', onYourCards)
      socket.off('turn_timer', onTimer)
      socket.off('join_error', onError)
      socket.off('bot_game_over', onBotGameOver)
      socket.off('room_left', onRoomLeft)
    }
  }, [])

  if (screen === 'waiting') return (
    <WaitingRoom lobby={lobby} myId={myId} onStart={() => socket.emit('start_game')} onLeave={requestLeaveRoom} />
  )

  if (!gs) return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center text-white text-xl">Cargando...</div>
  )

  if (gs.phase === 'FINISHED') return (
    <>
      <TournamentEndScreen players={gs.players} onRestart={() => window.location.reload()} />
      <div className="min-h-screen bg-zinc-900" />
    </>
  )

  const currentBB = gs.fixedBlinds?.bb || BLIND_LEVELS[gs.blindLevel]?.bb || 20
  const currentSB = gs.fixedBlinds?.sb || BLIND_LEVELS[gs.blindLevel]?.sb || 10

  const myServerIdx = gs.players.findIndex(p => p.id === myId)
  const ordered = myServerIdx >= 0
    ? [...gs.players.slice(myServerIdx), ...gs.players.slice(0, myServerIdx)]
    : gs.players

  const me = ordered[0]
  const toCall = me ? Math.max(0, gs.highestBet - me.roundBet) : 0
  const isMyTurn = gs.players[gs.turnIdx]?.id === myId
    && !['WAITING', 'SHOWDOWN', 'FINISHED'].includes(gs.phase)
    && me?.status === 'ACTIVE'

  const minRaise = Math.max(currentBB, toCall)
  const maxRaise = Math.max(0, (me?.chips || 0) - toCall)
  const safeRaise = Math.min(Math.max(customRaise, minRaise), maxRaise)

  const dealerPlayerId = gs.players[gs.dealerIdx]?.id
  const turnPlayerId = gs.players[gs.turnIdx]?.id

  const act = (type, amount = 0) => {
    if (type === 'FOLD') sounds.fold()
    else if (type === 'RAISE') sounds.chips()
    else sounds.check()
    socket.emit('player_action', { type, amount })
  }

  const myHandName = myCards.length > 0 && gs.phase !== 'START'
    ? evaluateBestHand(myCards, gs.board || []).name : ''

  // Quick bet helpers
  const halfPot = Math.max(minRaise, Math.min(Math.floor(gs.pot / 2), maxRaise))
  const fullPot = Math.max(minRaise, Math.min(gs.pot, maxRaise))
  const twoBB = Math.max(minRaise, Math.min(currentBB * 2, maxRaise))

  const isPending = gs.pendingPlayers?.some(p => p.id === myId)
  const amSpectator = myServerIdx === -1 && !isPending

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 sm:p-4 font-sans text-white overflow-hidden relative"
      style={{ background: 'linear-gradient(160deg, #050d1a 0%, #0a1628 40%, #07111f 100%)' }}>

      {/* HUD top-right */}
      <div className="absolute top-3 right-3 border border-slate-700/50 px-3 py-2 rounded-xl text-right z-40 text-xs shadow-xl"
        style={{ background: 'rgba(10,15,26,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="text-slate-500">Sala <span className="text-white font-mono font-bold">{lobby?.code}</span></div>
        {!gs.fixedBlinds && <div className="text-slate-400 mt-0.5">Nivel {gs.blindLevel + 1}</div>}
        <div className="text-yellow-400 font-mono font-bold">${currentSB}/<span>{currentBB}</span></div>
        <div className="text-slate-500 mt-0.5">Mano #{gs.handCount}</div>
        <button
          onClick={requestLeaveRoom}
          className="mt-2 w-full text-[10px] font-bold uppercase tracking-wider border border-slate-600 hover:border-red-500/60 hover:text-red-300 rounded-lg px-2 py-1 text-slate-300 transition-colors"
          style={{ background: 'rgba(15,23,42,0.75)' }}>
          Salir
        </button>
      </div>

      {/* Spectator / Pending badge */}
      {(isPending || amSpectator) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 border border-blue-500/40 rounded-full px-4 py-1.5 text-xs font-bold text-blue-300 shadow-lg md:hidden"
          style={{ background: 'rgba(30,64,175,0.25)', backdropFilter: 'blur(8px)' }}>
          {isPending ? 'â³ EntrÃ¡s en la prÃ³xima mano' : 'ðŸ‘ Espectador'}
        </div>
      )}
      {(isPending || amSpectator) && (
        <div className="hidden md:flex absolute top-3 left-1/2 -translate-x-1/2 z-50 items-center gap-2 border border-blue-500/40 rounded-full px-4 py-1.5 text-xs font-bold text-blue-300 shadow-lg"
          style={{ background: 'rgba(30,64,175,0.25)', backdropFilter: 'blur(8px)' }}>
          {isPending ? 'â³ EntrÃ¡s en la prÃ³xima mano' : 'ðŸ‘ Modo espectador'}
        </div>
      )}

      {/* Log desktop */}
      <div className="absolute top-3 left-3 bg-black/70 border border-white/10 rounded-xl w-52 sm:w-64 h-36 sm:h-52 overflow-y-auto p-2 text-[10px] sm:text-xs font-mono text-gray-300 z-40 hidden md:block shadow-lg">
        <div className="text-yellow-500 font-bold mb-1 border-b border-white/10 pb-1 sticky top-0 bg-black/90">Historial</div>
        {gs.logs.map((log, i) => <div key={i} className="mb-1 leading-tight">{log}</div>)}
        <div ref={logsEndRef} />
      </div>

      {/* Log mobile toggle */}
      <button onClick={() => setShowLog(v => !v)} className="absolute top-3 left-3 md:hidden bg-black/70 border border-white/10 rounded-xl w-10 h-10 flex items-center justify-center text-lg z-40">
        ðŸ“‹
      </button>
      {showLog && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:hidden" onClick={() => setShowLog(false)}>
          <div className="w-full bg-zinc-900 border-t border-white/10 rounded-t-2xl p-4 h-2/3 overflow-y-auto font-mono text-xs text-gray-300" onClick={e => e.stopPropagation()}>
            <div className="text-yellow-500 font-bold mb-2">Historial de acciones</div>
            {gs.logs.map((log, i) => <div key={i} className="mb-1.5 leading-tight">{log}</div>)}
          </div>
        </div>
      )}

      {/* Global timer bar (only for my turn) */}
      {isMyTurn && timer.playerId === myId && timer.timeLeft > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 z-50">
          <div
            className={`h-full transition-all duration-1000 ${timer.timeLeft <= 8 ? 'bg-red-500' : timer.timeLeft <= 15 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${(timer.timeLeft / TURN_SECONDS) * 100}%` }}
          />
        </div>
      )}

      {/* Message */}
      <div className="text-lg sm:text-2xl font-bold text-yellow-400 mb-4 sm:mb-8 h-8 text-center drop-shadow-md z-20 px-4">
        {gs.message}
      </div>

      {/* Table */}
      <div className="poker-table relative w-full max-w-4xl h-[450px] sm:h-[500px] rounded-[120px] sm:rounded-[250px] flex flex-col items-center justify-center mb-24 sm:mb-20 mt-4 md:mt-0">

        {/* Felt texture + overlays */}
        <div className="poker-table-felt absolute inset-[14px] sm:inset-[18px] rounded-[102px] sm:rounded-[228px] overflow-hidden pointer-events-none">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 15%, rgba(255,255,255,0.08) 0%, transparent 58%)' }} />
        </div>
        {/* Table watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <div className="poker-table-watermark font-casino" style={{ fontSize: 'clamp(56px,13vw,128px)' }}>TEXAS HOLD&apos;EM</div>
        </div>

        {/* Center */}
        <div className="flex flex-col items-center gap-2 z-10">
          {/* Phase badge */}
          {!['WAITING','SHOWDOWN','FINISHED'].includes(gs.phase) && (
            <div className="poker-phase-pill px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] font-casino">
              {gs.phase === 'PREFLOP' ? 'Pre-Flop' : gs.phase}
            </div>
          )}
          {gs.pot > 0 && (
            <div ref={potRef} key={potKey} className="poker-pot pot-pulse flex items-center gap-2.5 rounded-full px-5 py-2">
              <span className="text-yellow-500 text-sm">ðŸ’°</span>
              <span className="text-yellow-300 font-black text-lg sm:text-xl font-mono tracking-wide">${gs.pot.toLocaleString()}</span>
            </div>
          )}
          {gs.pot === 0 && <div ref={potRef} className="h-0 w-0" />}
          <div className="poker-board-tray flex gap-1 sm:gap-2 min-h-[96px] rounded-2xl p-2 sm:p-3">
            {[0,1,2,3,4].map(i => (
              gs.board[i]
                ? <div key={`${boardFlipKey}-${i}`} className="card-flip" style={{ '--card-i': i }}>
                    <Card card={gs.board[i]} />
                  </div>
                : <Card key={`empty-${i}`} card={null} />
            ))}
          </div>
        </div>

        {/* Players */}
        {ordered.map((p, displayIdx) => {
          if (displayIdx >= 6) return null
          const isMe = p.id === myId
          const isTurn = p.id === turnPlayerId && !['WAITING','SHOWDOWN'].includes(gs.phase)
          const isDealer = p.id === dealerPlayerId
          const isWinner = gs.winners?.includes(p.id)
          const showTimer = isTurn && timer.playerId === p.id && timer.timeLeft > 0
          const holeCards = isMe ? myCards : []
          const showCards = isMe ? myCards.length > 0 : (p.holeCount || 0) > 0

          return (
            <div key={p.id} className={`absolute ${POS[displayIdx]} flex flex-col items-center z-20 transition-all duration-300`}>

              {/* Bet badge */}
              {(p.roundBet > 0 || p.lastAction) && (
                <div className={`absolute ${displayIdx > 2 ? 'bottom-[-30px]' : isMe ? 'top-[-82px]' : 'top-[-30px]'} ${actionColor(p.lastAction)} px-3 py-1 rounded-full text-xs whitespace-nowrap shadow-lg border z-30`}>
                  {p.lastAction || 'Apuesta'} {p.roundBet > 0 && <span className="text-yellow-400 ml-1 font-mono">${p.roundBet}</span>}
                </div>
              )}

              {/* Cards */}
              {showCards && p.status !== 'FOLDED' && p.status !== 'ELIMINATED' && (
                <div className="flex gap-1 mb-[-20px] sm:mb-[-15px] z-0">
                  {isMe
                    ? holeCards.map((c, i) => (
                        <div key={`${holeFlipKey}-${i}`} className="card-flip" style={{ '--card-i': i }}>
                          <Card card={c} />
                        </div>
                      ))
                    : Array.from({ length: p.holeCount || 2 }).map((_, i) => <Card key={i} hidden small />)
                  }
                </div>
              )}

              {/* Seat */}
              <div ref={el => { playerSeatRefs.current[p.id] = el }}
                className={`poker-seat relative rounded-xl p-2 border-2 ${
                isWinner ? 'border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.9)] scale-110 bg-yellow-900/40 z-40'
                : isTurn ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] scale-105'
                : isMe ? 'border-blue-500'
                : 'border-slate-700'
              } w-28 sm:w-32 z-10 transition-all duration-300`}>

                {isWinner && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest z-50 animate-bounce whitespace-nowrap">
                    Ganador!
                  </div>
                )}
                {isDealer && (
                  <div className="absolute -top-3 -right-3 w-6 h-6 bg-white text-black rounded-full flex items-center justify-center font-black text-xs shadow-md border-2 border-gray-300 z-30">D</div>
                )}
                {showTimer && (
                  <div className="absolute -top-3 -left-3 z-30">
                    <TimerRing timeLeft={timer.timeLeft} />
                  </div>
                )}

                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-base">{p.emoji || 'ðŸŽ´'}</span>
                  <span className="text-xs font-bold truncate max-w-[72px]">{p.name}{isMe && <span className="text-blue-400 ml-1 text-[9px]">(TÃº)</span>}</span>
                </div>
                <div className="text-center text-yellow-500 font-mono text-xs sm:text-sm">${p.chips}</div>

                {p.status === 'FOLDED' && <div className="absolute inset-0 bg-black/75 rounded-xl flex items-center justify-center text-red-500 font-bold uppercase text-xs">Fold</div>}
                {p.status === 'ELIMINATED' && <div className="absolute inset-0 bg-red-900/80 rounded-xl flex items-center justify-center text-white font-bold uppercase text-[10px] text-center">Eliminado</div>}
              </div>

              {/* Hand name at showdown */}
              {gs.phase === 'SHOWDOWN' && p.handEval && p.status !== 'FOLDED' && (
                <div className={`mt-2 text-[10px] sm:text-xs px-2 py-1 rounded-full whitespace-nowrap shadow-md border ${isWinner ? 'bg-yellow-900/80 text-yellow-300 border-yellow-500' : 'bg-blue-900/80 text-blue-200 border-blue-600'}`}>
                  {p.handEval.name}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pending players strip */}
      {gs.pendingPlayers?.length > 0 && (
        <div className="absolute bottom-[160px] sm:bottom-[140px] right-3 z-30 border border-blue-500/30 rounded-xl px-3 py-2 text-xs max-w-[160px]"
          style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="text-blue-400 font-bold mb-1 text-[10px] uppercase tracking-widest">Esperando</div>
          {gs.pendingPlayers.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 mb-1">
              <span>{p.emoji || 'ðŸŽ´'}</span>
              <span className="text-slate-300 truncate text-[11px]">{p.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* My hand info + equity */}
      <div className="w-full max-w-4xl min-h-[30px] flex items-center justify-center px-2 mb-1 z-30">
        {myCards.length > 0 && gs.phase !== 'SHOWDOWN' && me?.status !== 'FOLDED' && me?.status !== 'ELIMINATED' && (
          <div className="flex items-center gap-2">
            <div className="bg-blue-900/80 border border-blue-500/50 text-blue-100 text-xs px-3 py-1 rounded-full font-bold">
              {myHandName}
            </div>
            <EquityBadge win={equity?.win} tie={equity?.tie} />
          </div>
        )}
      </div>

      {/* Action controls */}
      <div className="w-full max-w-4xl flex justify-center gap-2 sm:gap-3 mt-2 px-2 z-30">
        {gs.phase === 'SHOWDOWN' || gs.phase === 'WAITING' ? (
          isBotRoom ? (
            <div className="text-slate-500 text-sm py-4 animate-pulse">Siguiente mano en 3 segundos...</div>
          ) : (
            <button onClick={() => socket.emit('new_hand')}
              className="text-black font-black text-lg py-4 px-10 rounded-full active:scale-95 transition-transform uppercase tracking-widest w-full sm:w-auto"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 30px rgba(245,158,11,0.4)' }}>
              Nueva Mano
            </button>
          )
        ) : isMyTurn ? (
          <div className="flex flex-col w-full gap-2">

            {/* Quick bet buttons */}
            {me?.chips > toCall && maxRaise >= minRaise && (
              <div className="flex gap-2 justify-center">
                {[
                  { label: '2x BB', val: twoBB },
                  { label: 'Â½ Pozo', val: halfPot },
                  { label: 'Pozo', val: fullPot },
                  { label: 'All-In', val: maxRaise }
                ].map(({ label, val }) => (
                  <button key={label}
                    onClick={() => { setCustomRaise(val); act('RAISE', val) }}
                    className="bg-zinc-700 hover:bg-zinc-600 border border-zinc-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all">
                    {label}
                    <div className="text-yellow-400 font-mono text-[10px]">${val}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex w-full gap-2 sm:gap-3">
              <button onClick={() => act('FOLD')} className="bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-4 sm:px-8 rounded-xl shadow-lg flex-1 active:scale-95 transition-all text-sm sm:text-base min-w-[80px]">
                No Voy
              </button>
              <button onClick={() => act('CALL')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 sm:px-8 rounded-xl shadow-lg flex-1 active:scale-95 transition-all flex flex-col items-center justify-center text-sm sm:text-base min-w-[100px]">
                <span>{toCall > 0 ? 'Igualar' : 'Pasar'}</span>
                {toCall > 0 && <span className="text-xs opacity-80 font-mono">${toCall}</span>}
              </button>
              <div className="bg-green-800/60 border border-green-600 rounded-xl p-2 flex-1 flex flex-col justify-center min-w-[140px] shadow-lg">
                {me?.chips > toCall && maxRaise >= minRaise ? (
                  <>
                    <div className="flex items-center gap-1 mb-1.5 px-1">
                      <span className="text-[9px] text-gray-400">Min</span>
                      <input type="range" min={minRaise} max={maxRaise} step={10}
                        value={safeRaise}
                        onChange={e => setCustomRaise(Number(e.target.value))}
                        className="flex-1 accent-yellow-400 h-1 cursor-pointer" />
                      <span className="text-[9px] text-gray-400">Max</span>
                    </div>
                    <button onClick={() => act('RAISE', safeRaise)}
                      className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg active:scale-95 transition-all flex items-center justify-center gap-1 text-sm w-full">
                      Subir <span className="text-yellow-300 font-mono">${safeRaise}</span>
                    </button>
                  </>
                ) : (
                  <button onClick={() => act('RAISE', maxRaise)} disabled={me?.chips <= toCall}
                    className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold py-3 rounded-lg active:scale-95 transition-all w-full text-sm">
                    All-In
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-black/40 text-gray-500 font-bold py-4 px-8 rounded-xl uppercase tracking-widest text-sm w-full text-center border border-white/5">
            {me?.status === 'FOLDED' || me?.status === 'ALL_IN' || me?.status === 'ELIMINATED'
              ? 'Esperando que termine la mano...' : 'Esperando tu turno...'}
          </div>
        )}
      </div>

      {/* Flying chips overlay */}
      {flyingChips.map(chip => (
        <div key={chip.id} className="chip-flying"
          style={{
            left: chip.x,
            top: chip.y,
            '--chip-tx': `${chip.tx}px`,
            '--chip-ty': `${chip.ty}px`,
            background: 'radial-gradient(circle at 38% 32%, #fde68a, #b45309)',
          }}>
          $
        </div>
      ))}
    </div>
  )
}

