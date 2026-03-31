const express = require('express');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { createGameState, startHand, handleAction, STARTING_CHIPS } = require('./game/gameManager');
const { createBots, decideBotAction } = require('./game/botPlayer');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const PUBLIC_SERVER_URL = process.env.PUBLIC_SERVER_URL || `http://localhost:${process.env.PORT || 3001}`;
const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const parseAllowedOrigins = () => {
  const list = String(CORS_ORIGIN)
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  if (list.length === 0) return ['*'];
  return list;
};

const allowedOrigins = parseAllowedOrigins();
const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes('*')) return true;
  return allowedOrigins.includes(origin);
};

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => corsOptions.origin(origin, callback),
    methods: corsOptions.methods,
  }
});
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

const COIN_PACKS = {
  STARTER: { label: 'Paquete Starter', chips: 5000, price: 1500, currency: 'ARS' },
  PRO: { label: 'Paquete Pro', chips: 15000, price: 3900, currency: 'ARS' },
  HIGHROLLER: { label: 'Paquete High Roller', chips: 50000, price: 10900, currency: 'ARS' },
};

const mpClient = MP_ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }) : null;
const paymentClient = mpClient ? new Payment(mpClient) : null;
const preferenceClient = mpClient ? new Preference(mpClient) : null;
const USERS_FILE_PATH = path.join(__dirname, 'data', 'users.json');
const AUTH_TOKEN_TTL_MS = Number(process.env.AUTH_TOKEN_TTL_MS) || 1000 * 60 * 60 * 24 * 7;
const BOOTSTRAP_ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
const BOOTSTRAP_ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || 'admin1234');
const BOOTSTRAP_ADMIN_NAME = String(process.env.ADMIN_NAME || 'Administrador').trim() || 'Administrador';

const rooms = new Map();
const authSessions = new Map();
const TURN_SECONDS = 30;

const DEFAULT_TABLES = [
  { code: 'EASY01', name: '🟢 Mesa Principiante', desc: 'Para empezar a jugar', fixedBlinds: { sb: 10, bb: 20 } },
  { code: 'MED002', name: '🟡 Mesa Intermedia',   desc: 'Ciegas medias, buen ritmo', fixedBlinds: { sb: 50, bb: 100 } },
  { code: 'HIGH03', name: '🔴 Mesa Alta',          desc: 'Apuestas altas', fixedBlinds: { sb: 100, bb: 200 } },
  { code: 'PRO004', name: '💀 Mesa Pro',           desc: 'Solo para los valientes', fixedBlinds: { sb: 500, bb: 1000 } },
];

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const makeExternalReference = (walletId, packId) => `${walletId}:${packId}`;
const parseExternalReference = (value) => {
  if (!value || typeof value !== 'string') return null;
  const [walletId, packId] = value.split(':');
  if (!walletId || !packId) return null;
  return { walletId, packId: packId.toUpperCase() };
};

const ensureUsersStorage = () => {
  const dir = path.dirname(USERS_FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(USERS_FILE_PATH)) {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify({ users: [] }, null, 2), 'utf8');
  }
};

const loadUsers = () => {
  ensureUsersStorage();
  try {
    const raw = fs.readFileSync(USERS_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.users) ? parsed.users : [];
  } catch (error) {
    console.error('users load error', error?.message || error);
    return [];
  }
};

const persistUsers = (users) => {
  ensureUsersStorage();
  fs.writeFileSync(USERS_FILE_PATH, JSON.stringify({ users }, null, 2), 'utf8');
};

const normalizeUsername = (value) => String(value || '').trim().toLowerCase();
const isValidUsername = (value) => /^[a-z0-9_.-]{3,32}$/.test(value);
const isValidRole = (value) => value === 'admin' || value === 'player';

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) return false;
  const [salt, expected] = storedHash.split(':');
  const computed = crypto.scryptSync(password, salt, 64).toString('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const computedBuffer = Buffer.from(computed, 'hex');
  if (expectedBuffer.length !== computedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
};

const toPublicUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  role: user.role,
  createdAt: user.createdAt,
  createdBy: user.createdBy || null,
});

let users = loadUsers();

const findUserByUsername = (username) => {
  const normalized = normalizeUsername(username);
  return users.find(u => u.username === normalized) || null;
};

const findUserById = (id) => users.find(u => u.id === id) || null;

const createUser = ({ username, name, password, role = 'player', createdBy = null }) => {
  const normalized = normalizeUsername(username);
  const safeName = String(name || '').trim();
  const safeRole = String(role || 'player').trim().toLowerCase();

  if (!isValidUsername(normalized)) throw new Error('username_invalid');
  if (password.length < 6 || password.length > 128) throw new Error('password_invalid');
  if (!isValidRole(safeRole)) throw new Error('role_invalid');
  if (findUserByUsername(normalized)) throw new Error('username_taken');

  const user = {
    id: `usr_${crypto.randomUUID()}`,
    username: normalized,
    name: safeName || normalized,
    role: safeRole,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    createdBy,
  };

  users.push(user);
  persistUsers(users);
  return user;
};

const issueAuthToken = (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  authSessions.set(token, { userId, expiresAt: Date.now() + AUTH_TOKEN_TTL_MS });
  return token;
};

const getSessionUser = (token) => {
  const session = authSessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    authSessions.delete(token);
    return null;
  }
  return findUserById(session.userId);
};

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of authSessions.entries()) {
    if (session.expiresAt <= now) authSessions.delete(token);
  }
}, 60000).unref();

const requireAuth = (req, res, next) => {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  const user = getSessionUser(token);
  if (!user) {
    res.status(401).json({ error: 'Token invalido o expirado.' });
    return;
  }

  req.authUser = user;
  req.authToken = token;
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.authUser?.role !== 'admin') {
    res.status(403).json({ error: 'Permisos insuficientes.' });
    return;
  }
  next();
};

const bootstrapAdmin = () => {
  if (!isValidUsername(BOOTSTRAP_ADMIN_USERNAME)) {
    console.warn('ADMIN_USERNAME invalido. Debe cumplir /^[a-z0-9_.-]{3,32}$/');
    return;
  }
  if (BOOTSTRAP_ADMIN_PASSWORD.length < 6) {
    console.warn('ADMIN_PASSWORD invalido. Debe tener al menos 6 caracteres.');
    return;
  }
  if (findUserByUsername(BOOTSTRAP_ADMIN_USERNAME)) return;

  createUser({
    username: BOOTSTRAP_ADMIN_USERNAME,
    name: BOOTSTRAP_ADMIN_NAME,
    password: BOOTSTRAP_ADMIN_PASSWORD,
    role: 'admin',
    createdBy: null,
  });

  if (!process.env.ADMIN_PASSWORD) {
    console.warn('Se creo admin por defecto: usuario "admin", password "admin1234". Configura ADMIN_PASSWORD.');
  }
  console.log(`Admin bootstrap listo: ${BOOTSTRAP_ADMIN_USERNAME}`);
};

// ── Timer ──────────────────────────────────────────────────────────────────
const clearRoomTimer = (room) => {
  if (room._timer) { clearInterval(room._timer); room._timer = null; }
  if (room._botTimeout) { clearTimeout(room._botTimeout); room._botTimeout = null; }
  room._timerPlayerId = null;
};

const startTurnTimer = (code) => {
  const room = rooms.get(code);
  if (!room?.gameState) return;
  clearRoomTimer(room);

  const gs = room.gameState;
  if (['WAITING', 'SHOWDOWN', 'FINISHED'].includes(gs.phase)) return;

  const cp = gs.players[gs.turnIdx];
  if (!cp || cp.status !== 'ACTIVE' || cp.chips === 0) return;

  let timeLeft = TURN_SECONDS;
  room._timerPlayerId = cp.id;
  io.to(code).emit('turn_timer', { timeLeft, playerId: cp.id });

  room._timer = setInterval(() => {
    const r = rooms.get(code);
    if (!r || r._timerPlayerId !== cp.id) return;
    timeLeft--;
    io.to(code).emit('turn_timer', { timeLeft, playerId: cp.id });
    if (timeLeft <= 0) {
      clearRoomTimer(r);
      const p = r.gameState?.players[r.gameState.turnIdx];
      if (!p || p.id !== cp.id) return;
      handleAction(r.gameState, p.id, (r.gameState.highestBet - p.roundBet) === 0 ? 'CHECK' : 'FOLD', 0);
      broadcastGameState(code);
    }
  }, 1000);
};

// ── Bot scheduling ─────────────────────────────────────────────────────────
const scheduleBotAction = (code) => {
  const room = rooms.get(code);
  if (!room?.gameState || !room.isBotRoom) return;
  const gs = room.gameState;
  if (['WAITING', 'SHOWDOWN', 'FINISHED'].includes(gs.phase)) return;

  const cp = gs.players[gs.turnIdx];
  if (!cp || !cp.isBot) return;

  const delay = 700 + Math.random() * 1000; // 0.7–1.7s
  room._botTimeout = setTimeout(() => {
    const r = rooms.get(code);
    if (!r?.gameState) return;
    const gs2 = r.gameState;
    const currentBot = gs2.players[gs2.turnIdx];
    if (!currentBot || !currentBot.isBot) return;

    const meta = r.botMeta?.find(b => b.id === currentBot.id);
    if (!meta) { handleAction(gs2, currentBot.id, 'CHECK', 0); }
    else {
      const decision = decideBotAction(gs2, meta);
      handleAction(gs2, currentBot.id, decision.type, decision.amount || 0);
    }
    broadcastGameState(code);
  }, delay);
};

// ── Broadcast ──────────────────────────────────────────────────────────────
const getRoomListItem = (room) => ({
  code: room.code,
  name: room.name,
  desc: room.desc || '',
  isDefault: room.isDefault || false,
  fixedBlinds: room.fixedBlinds || null,
  playerCount: room.players.length,
  pendingCount: (room.pendingPlayers || []).length,
  maxPlayers: 6,
  phase: room.gameState?.phase || 'WAITING',
  handCount: room.gameState?.handCount || 0,
});

const broadcastLobbyList = () => {
  const list = Array.from(rooms.values())
    .filter(r => r.isDefault || r.players.length > 0)
    .map(getRoomListItem);
  io.to('__lobby__').emit('room_list', list);
};

const broadcastGameState = (code) => {
  const room = rooms.get(code);
  if (!room?.gameState) return;
  const gs = room.gameState;

  const pub = {
    phase: gs.phase,
    pot: gs.pot,
    board: gs.board,
    dealerIdx: gs.dealerIdx,
    turnIdx: gs.turnIdx,
    highestBet: gs.highestBet,
    message: gs.message,
    winners: gs.winners,
    blindLevel: gs.blindLevel,
    fixedBlinds: gs.fixedBlinds,
    handCount: gs.handCount,
    logs: gs.logs,
    pendingPlayers: (room.pendingPlayers || []).map(p => ({ id: p.id, name: p.name, emoji: p.emoji })),
    players: gs.players.map(p => ({
      id: p.id, name: p.name, emoji: p.emoji || '🎴',
      chips: p.chips, roundBet: p.roundBet, handInvested: p.handInvested,
      status: p.status, hasActed: p.hasActed, lastAction: p.lastAction,
      handEval: gs.phase === 'SHOWDOWN' ? p.handEval : null,
      holeCount: p.hole.length
    }))
  };

  io.to(code).emit('game_state', pub);
  gs.players.forEach(p => { io.to(p.id).emit('your_cards', p.hole); });

  if (['WAITING', 'SHOWDOWN', 'FINISHED'].includes(gs.phase)) {
    clearRoomTimer(room);
    io.to(code).emit('turn_timer', { timeLeft: 0, playerId: null });

    // Auto-start next hand in bot rooms after SHOWDOWN
    if (room.isBotRoom && gs.phase === 'SHOWDOWN') {
      room._botTimeout = setTimeout(() => {
        const r = rooms.get(code);
        if (!r?.gameState) return;
        // Remove busted players (0 chips)
        r.gameState.players = r.gameState.players.filter(p => p.chips > 0 || p.isBot);
        // Refill bots that went bust
        r.gameState.players.forEach(p => {
          if (p.isBot && p.chips <= 0) p.chips = STARTING_CHIPS;
        });
        if (r.gameState.players.filter(p => p.chips > 0).length < 2) {
          // Human busted — end room
          io.to(code).emit('bot_game_over', { message: 'Te quedaste sin fichas. ¡Hasta la próxima!' });
          clearRoomTimer(r);
          rooms.delete(code);
          return;
        }
        startHand(r.gameState);
        broadcastGameState(code);
      }, 3000);
    }
  } else {
    const cp = gs.players[gs.turnIdx];
    if (room.isBotRoom && cp?.isBot) {
      clearRoomTimer(room);
      io.to(code).emit('turn_timer', { timeLeft: 0, playerId: null });
      scheduleBotAction(code);
    } else {
      startTurnTimer(code);
    }
  }

  broadcastLobbyList();
};

// ── Default rooms ──────────────────────────────────────────────────────────
const initDefaultRooms = () => {
  DEFAULT_TABLES.forEach(t => {
    rooms.set(t.code, {
      code: t.code, name: t.name, desc: t.desc,
      fixedBlinds: t.fixedBlinds,
      isDefault: true, isPrivate: false,
      hostId: null,
      players: [], pendingPlayers: [],
      gameState: null,
      _timer: null, _timerPlayerId: null,
    });
  });
};

const resetDefaultRoom = (code) => {
  const room = rooms.get(code);
  if (!room) return;
  clearRoomTimer(room);
  room.hostId = null;
  room.players = [];
  room.pendingPlayers = [];
  room.gameState = null;
  broadcastLobbyList();
};

const removeSocketFromRoom = (socket, { notifySelf = false } = {}) => {
  const code = socket.data.roomCode;
  if (!code) {
    if (notifySelf) socket.emit('room_left');
    return;
  }

  const room = rooms.get(code);
  socket.leave(code);
  socket.data.roomCode = null;

  if (!room) {
    if (notifySelf) socket.emit('room_left');
    broadcastLobbyList();
    return;
  }

  room.players = room.players.filter(p => p.id !== socket.id);
  room.pendingPlayers = (room.pendingPlayers || []).filter(p => p.id !== socket.id);

  if (room.players.length === 0 || room.isBotRoom) {
    if (room.isDefault) {
      resetDefaultRoom(code);
      if (notifySelf) socket.emit('room_left');
      return;
    }
    clearRoomTimer(room);
    rooms.delete(code);
    if (notifySelf) socket.emit('room_left');
    broadcastLobbyList();
    return;
  }

  if (room.hostId === socket.id) room.hostId = room.players[0]?.id || null;

  if (room.gameState) {
    const gp = room.gameState.players.find(p => p.id === socket.id);
    if (gp && gp.status === 'ACTIVE') {
      clearRoomTimer(room);
      handleAction(room.gameState, socket.id, 'FOLD');
    }
    broadcastGameState(code);
  }

  io.to(code).emit('room_updated', {
    hostId: room.hostId,
    players: [...room.players, ...(room.pendingPlayers || [])]
  });

  if (notifySelf) socket.emit('room_left');
  broadcastLobbyList();
};

// ── Socket handlers ────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('join_lobby', () => {
    socket.join('__lobby__');
    const list = Array.from(rooms.values())
      .filter(r => r.isDefault || r.players.length > 0)
      .map(getRoomListItem);
    socket.emit('room_list', list);
  });

  socket.on('leave_lobby', () => socket.leave('__lobby__'));

  socket.on('create_room', ({ name, emoji, chips }) => {
    if (!name?.trim()) return;
    const safeChips = (Number.isInteger(chips) && chips >= 100 && chips <= 50000) ? chips : STARTING_CHIPS;
    const code = generateCode();
    rooms.set(code, {
      code, name: `Sala de ${name.trim()}`, desc: 'Sala privada',
      fixedBlinds: null, isDefault: false, isPrivate: true,
      hostId: socket.id,
      players: [{ id: socket.id, name: name.trim(), emoji: emoji || '🎴', chips: safeChips }],
      pendingPlayers: [],
      gameState: null,
      _timer: null, _timerPlayerId: null,
    });
    socket.join(code);
    socket.leave('__lobby__');
    socket.data.roomCode = code;
    socket.emit('room_created', {
      code, hostId: socket.id,
      players: [{ id: socket.id, name: name.trim(), emoji: emoji || '🎴' }],
      roomName: `Sala de ${name.trim()}`
    });
    broadcastLobbyList();
  });

  socket.on('join_room', ({ name, code, emoji, chips }) => {
    const upper = code?.toUpperCase();
    const room = rooms.get(upper);
    if (!room) { socket.emit('join_error', 'Sala no encontrada'); return; }

    const total = room.players.length + (room.pendingPlayers?.length || 0);
    if (total >= 6) { socket.emit('join_error', 'Sala llena (máx. 6)'); return; }

    const safeChips = (Number.isInteger(chips) && chips >= 100 && chips <= 50000) ? chips : STARTING_CHIPS;
    const player = { id: socket.id, name: name.trim(), emoji: emoji || '🎴', chips: safeChips };
    const midGame = room.gameState && !['WAITING', 'SHOWDOWN', 'FINISHED'].includes(room.gameState.phase);

    if (midGame) {
      room.pendingPlayers = room.pendingPlayers || [];
      room.pendingPlayers.push(player);
    } else {
      room.players.push(player);
      if (room.gameState) {
        room.gameState.players.push({
          id: socket.id, name: name.trim(), emoji: emoji || '🎴',
          chips: STARTING_CHIPS, hole: [], roundBet: 0, handInvested: 0,
          status: 'ACTIVE', hasActed: false, lastAction: '', handEval: null
        });
      }
    }

    if (!room.hostId) room.hostId = socket.id;
    socket.join(upper);
    socket.leave('__lobby__');
    socket.data.roomCode = upper;

    socket.emit('room_joined', {
      code: upper, hostId: room.hostId,
      players: [...room.players, ...(room.pendingPlayers || [])],
      roomName: room.name, isPending: midGame
    });
    socket.to(upper).emit('room_updated', {
      hostId: room.hostId,
      players: [...room.players, ...(room.pendingPlayers || [])]
    });

    if (room.gameState) broadcastGameState(upper);
    broadcastLobbyList();
  });

  socket.on('create_bot_room', ({ name, emoji, chips, botCount }) => {
    if (!name?.trim()) return;
    const safeChips = (Number.isInteger(chips) && chips >= 100 && chips <= 50000) ? chips : STARTING_CHIPS;
    const safeBotCount = Math.min(Math.max(1, botCount || 3), 5);
    const code = generateCode();

    const human = { id: socket.id, name: name.trim(), emoji: emoji || '🎴', chips: safeChips };
    const bots = createBots(safeBotCount);
    const botPlayers = bots.map(b => ({
      id: b.id, name: b.name, emoji: b.emoji, chips: STARTING_CHIPS, isBot: true,
    }));

    const allPlayers = [human, ...botPlayers];

    rooms.set(code, {
      code, name: `Bots — ${name.trim()}`, desc: `${safeBotCount} bots`,
      fixedBlinds: { sb: 25, bb: 50 },
      isDefault: false, isPrivate: true, isBotRoom: true,
      hostId: socket.id,
      players: allPlayers,
      pendingPlayers: [],
      botMeta: bots,        // full bot personality data
      gameState: null,
      _timer: null, _timerPlayerId: null, _botTimeout: null,
    });

    socket.join(code);
    socket.leave('__lobby__');
    socket.data.roomCode = code;

    // Build game state and start immediately
    const room = rooms.get(code);
    room.gameState = createGameState(allPlayers, { fixedBlinds: room.fixedBlinds });
    // Mark bots in gameState
    room.gameState.players.forEach(p => {
      if (p.isBot === undefined) {
        const botMeta = bots.find(b => b.id === p.id);
        if (botMeta) p.isBot = true;
      }
    });
    startHand(room.gameState);

    socket.emit('room_joined', {
      code, hostId: socket.id,
      players: allPlayers,
      roomName: room.name,
      isBotRoom: true,
      isPending: false,
    });

    broadcastGameState(code);
  });

  socket.on('start_game', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    if (!room.isDefault && room.hostId !== socket.id) return;
    if (room.players.length < 2) { socket.emit('join_error', 'Necesitás al menos 2 jugadores'); return; }

    if (room.pendingPlayers?.length) {
      room.players.push(...room.pendingPlayers);
      room.pendingPlayers = [];
    }

    room.gameState = createGameState(room.players, { fixedBlinds: room.fixedBlinds || null });
    startHand(room.gameState);
    broadcastGameState(code);
  });

  socket.on('player_action', ({ type, amount }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room?.gameState) return;
    clearRoomTimer(room);
    handleAction(room.gameState, socket.id, type, amount || 0);
    broadcastGameState(code);
  });

  socket.on('get_game_state', () => {
    const code = socket.data.roomCode;
    if (code) broadcastGameState(code);
  });

  socket.on('new_hand', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room?.gameState) return;
    if (!['SHOWDOWN', 'FINISHED', 'WAITING'].includes(room.gameState.phase)) return;

    // Drain pending players into the game
    if (room.pendingPlayers?.length) {
      room.pendingPlayers.forEach(p => {
        room.players.push(p);
        room.gameState.players.push({
          id: p.id, name: p.name, emoji: p.emoji || '🎴',
          chips: p.chips || STARTING_CHIPS, hole: [], roundBet: 0, handInvested: 0,
          status: 'ACTIVE', hasActed: false, lastAction: '', handEval: null
        });
      });
      room.pendingPlayers = [];
    }

    startHand(room.gameState);
    broadcastGameState(code);
  });

  socket.on('leave_room', () => {
    removeSocketFromRoom(socket, { notifySelf: true });
  });

  socket.on('disconnect', () => {
    removeSocketFromRoom(socket);
  });
});

bootstrapAdmin();
initDefaultRooms();

app.get('/', (_, res) => res.send('Poker Server OK'));
app.get('/rooms', (_, res) => {
  const list = Array.from(rooms.values()).map(getRoomListItem);
  res.json(list);
});

app.post('/api/auth/login', (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  const user = findUserByUsername(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Credenciales invalidas.' });
    return;
  }

  const token = issueAuthToken(user.id);
  res.json({
    token,
    expiresInMs: AUTH_TOKEN_TTL_MS,
    user: toPublicUser(user),
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.authUser) });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  authSessions.delete(req.authToken);
  res.json({ ok: true });
});

app.get('/api/admin/users', requireAuth, requireAdmin, (_, res) => {
  const list = users.map(toPublicUser);
  res.json({ users: list });
});

app.post('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    const role = String(req.body?.role || 'player').trim().toLowerCase();

    if (!isValidUsername(username)) {
      res.status(400).json({ error: 'username invalido. Usa 3-32 chars: a-z, 0-9, _, ., -' });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'password invalido. Usa entre 6 y 128 caracteres.' });
      return;
    }
    if (!isValidRole(role)) {
      res.status(400).json({ error: 'role invalido. Valores permitidos: admin, player.' });
      return;
    }

    const created = createUser({
      username,
      name,
      password,
      role,
      createdBy: req.authUser.id,
    });

    res.status(201).json({ user: toPublicUser(created) });
  } catch (error) {
    if (error?.message === 'username_taken') {
      res.status(409).json({ error: 'Ese username ya existe.' });
      return;
    }
    if (error?.message === 'username_invalid') {
      res.status(400).json({ error: 'username invalido.' });
      return;
    }
    if (error?.message === 'password_invalid') {
      res.status(400).json({ error: 'password invalido.' });
      return;
    }
    if (error?.message === 'role_invalid') {
      res.status(400).json({ error: 'role invalido.' });
      return;
    }
    console.error('admin create user error', error?.message || error);
    res.status(500).json({ error: 'No se pudo crear la cuenta.' });
  }
});

app.get('/api/coin-packs', (_, res) => {
  const packs = Object.entries(COIN_PACKS).map(([id, data]) => ({
    id,
    ...data,
  }));
  res.json({ packs });
});

app.post('/api/payments/create-preference', async (req, res) => {
  try {
    if (!preferenceClient) {
      res.status(500).json({ error: 'Mercado Pago no esta configurado en el servidor.' });
      return;
    }

    const walletId = String(req.body?.walletId || '').trim();
    const packId = String(req.body?.packId || '').toUpperCase();
    const pack = COIN_PACKS[packId];

    if (!walletId || !/^[a-zA-Z0-9_-]{8,64}$/.test(walletId)) {
      res.status(400).json({ error: 'walletId invalido.' });
      return;
    }
    if (!pack) {
      res.status(400).json({ error: 'Paquete invalido.' });
      return;
    }

    const preference = await preferenceClient.create({
      body: {
        external_reference: makeExternalReference(walletId, packId),
        metadata: { walletId, packId, chips: pack.chips },
        items: [{
          id: packId,
          title: `${pack.label} (${pack.chips.toLocaleString('es-AR')} fichas)`,
          quantity: 1,
          unit_price: pack.price,
          currency_id: pack.currency,
        }],
        back_urls: {
          success: `${CLIENT_URL}/?mp_status=success`,
          failure: `${CLIENT_URL}/?mp_status=failure`,
          pending: `${CLIENT_URL}/?mp_status=pending`,
        },
        auto_return: 'approved',
        notification_url: `${PUBLIC_SERVER_URL}/api/payments/webhook`,
      }
    });

    res.json({
      preferenceId: preference.id,
      checkoutUrl: preference.init_point,
      sandboxCheckoutUrl: preference.sandbox_init_point,
    });
  } catch (error) {
    console.error('create-preference error', error?.message || error);
    res.status(500).json({ error: 'No se pudo crear la preferencia de pago.' });
  }
});

app.get('/api/payments/confirm', async (req, res) => {
  try {
    if (!paymentClient) {
      res.status(500).json({ error: 'Mercado Pago no esta configurado en el servidor.' });
      return;
    }

    const paymentId = Number(req.query.payment_id);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      res.status(400).json({ error: 'payment_id invalido.' });
      return;
    }

    const payment = await paymentClient.get({ id: paymentId });
    const ref = parseExternalReference(payment.external_reference);
    if (!ref) {
      res.status(400).json({ error: 'No se encontro referencia de wallet en el pago.' });
      return;
    }

    const pack = COIN_PACKS[ref.packId];
    if (!pack) {
      res.status(400).json({ error: 'Paquete no reconocido.' });
      return;
    }

    if (payment.status !== 'approved') {
      res.status(400).json({
        error: 'El pago todavia no esta aprobado.',
        status: payment.status,
      });
      return;
    }

    const txAmount = Number(payment.transaction_amount);
    if (!Number.isFinite(txAmount) || txAmount < pack.price) {
      res.status(400).json({ error: 'Monto de pago invalido.' });
      return;
    }

    res.json({
      ok: true,
      paymentId: payment.id,
      walletId: ref.walletId,
      packId: ref.packId,
      chips: pack.chips,
      status: payment.status,
    });
  } catch (error) {
    console.error('confirm payment error', error?.message || error);
    res.status(500).json({ error: 'No se pudo validar el pago.' });
  }
});

app.post('/api/payments/webhook', (req, res) => {
  // Webhook reservado para evolucion futura (auditoria/registro de pagos).
  // El credito actual de fichas se valida en /api/payments/confirm con payment_id.
  res.status(200).send('ok');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
