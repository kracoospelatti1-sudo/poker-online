import { useState } from 'react'
import Lobby from './pages/Lobby.jsx'
import BrowseRooms from './pages/BrowseRooms.jsx'
import Game from './pages/Game.jsx'
import Auth from './pages/Auth.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import { getOrCreateWalletId } from './utils/wallet.js'

const STARTING_CHIPS = 1500
const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

function getStoredChips() {
  const v = parseInt(localStorage.getItem('poker_chips'), 10)
  return !isNaN(v) && v > 0 ? v : STARTING_CHIPS
}

function getDirectJoinCode() {
  const match = window.location.pathname.match(/^\/sala\/([A-Z0-9]{4,8})$/i)
  return match ? match[1].toUpperCase() : null
}

export default function App() {
  const [screen, setScreen] = useState('lobby')
  const [auth, setAuth] = useState(null) // { token, user }
  const [profile, setProfile] = useState(null)  // { name, emoji, chips }
  const [roomData, setRoomData] = useState(null)
  const [myId, setMyId] = useState(null)
  const [pendingRoomCode] = useState(() => getDirectJoinCode())
  const [walletId] = useState(() => getOrCreateWalletId())

  const saveChips = (amount) => {
    const safe = amount > 0 ? amount : STARTING_CHIPS
    localStorage.setItem('poker_chips', String(safe))
    setProfile(prev => prev ? { ...prev, chips: safe } : prev)
  }

  const handleAuthSuccess = ({ token, user }) => {
    setAuth({ token, user })
    setProfile(null)
    setRoomData(null)
    setMyId(null)
    setScreen(user?.role === 'admin' ? 'admin' : 'lobby')
  }

  const handleLogout = async () => {
    const currentToken = auth?.token
    if (currentToken) {
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
        })
      } catch {
        // Logout best-effort; local cleanup still proceeds.
      }
    }
    setAuth(null)
    setProfile(null)
    setRoomData(null)
    setMyId(null)
    setScreen('lobby')
  }

  if (!auth) return (
    <Auth onAuthSuccess={handleAuthSuccess} />
  )

  if (screen === 'admin') return (
    <AdminPanel
      auth={auth}
      onContinue={() => setScreen('lobby')}
      onLogout={handleLogout}
    />
  )

  if (screen === 'lobby') return (
    <Lobby
      initialName={auth?.user?.name || auth?.user?.username || ''}
      onLogout={handleLogout}
      pendingRoomCode={pendingRoomCode}
      onProfileSet={(p) => {
        const chips = getStoredChips()
        setProfile({ ...p, chips })
        setScreen('browse')
      }}
    />
  )

  if (screen === 'browse') return (
    <BrowseRooms
      profile={profile}
      walletId={walletId}
      setMyId={setMyId}
      setRoomData={setRoomData}
      setScreen={setScreen}
      onChipsChange={saveChips}
      onBack={() => setScreen('lobby')}
      autoJoinCode={pendingRoomCode}
    />
  )

  return (
    <Game
      screen={screen}
      setScreen={setScreen}
      roomData={roomData}
      setRoomData={setRoomData}
      myId={myId}
      saveChips={saveChips}
      isBotRoom={!!roomData?.isBotRoom}
    />
  )
}
