import { useState } from 'react'
import Lobby from './pages/Lobby.jsx'
import BrowseRooms from './pages/BrowseRooms.jsx'
import Game from './pages/Game.jsx'
import { getOrCreateWalletId } from './utils/wallet.js'

const STARTING_CHIPS = 1500

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

  if (screen === 'lobby') return (
    <Lobby
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
