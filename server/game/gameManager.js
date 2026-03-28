const { createDeck, shuffle } = require('./deck');
const { evaluateBestHand } = require('./handEvaluator');

const BLIND_LEVELS = [
  { sb: 10, bb: 20 }, { sb: 20, bb: 40 }, { sb: 50, bb: 100 },
  { sb: 100, bb: 200 }, { sb: 200, bb: 400 }, { sb: 500, bb: 1000 }, { sb: 1000, bb: 2000 }
];

const STARTING_CHIPS = 1500;

const addLog = (gs, msg) => {
  gs.logs.push(msg);
  if (gs.logs.length > 50) gs.logs.shift();
};

const getCurrentBlinds = (gs) => gs.fixedBlinds || BLIND_LEVELS[gs.blindLevel];
const isActionable = (p) => p.status === 'ACTIVE' && p.chips > 0;
const isInHand = (p) => p.status === 'ACTIVE' || p.status === 'ALL_IN';

const nextIdxFrom = (gs, startIdx, predicate) => {
  const n = gs.players.length;
  if (!n) return -1;
  let idx = startIdx;
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    if (predicate(gs.players[idx])) return idx;
  }
  return -1;
};

const compareScores = (s1, s2) => {
  for (let i = 0; i < 6; i++) {
    const a = s1?.[i] ?? -1;
    const b = s2?.[i] ?? -1;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
};

const commitChips = (gs, p, rawAmount) => {
  const amount = Math.max(0, Math.min(p.chips, rawAmount));
  if (amount <= 0) return 0;
  p.chips -= amount;
  p.roundBet += amount;
  p.handInvested += amount;
  gs.pot += amount;
  if (p.chips === 0 && p.status === 'ACTIVE') p.status = 'ALL_IN';
  return amount;
};

// options: { fixedBlinds: { sb, bb }, startingBlindLevel: 0 }
const createGameState = (lobbyPlayers, options = {}) => ({
  phase: 'WAITING',
  pot: 0,
  board: [],
  deck: [],
  dealerIdx: -1,
  turnIdx: 0,
  highestBet: 0,
  lastFullRaiseSize: 0,
  minRaiseTo: 0,
  message: 'Esperando para comenzar...',
  winners: [],
  blindLevel: options.startingBlindLevel || 0,
  fixedBlinds: options.fixedBlinds || null,
  handCount: 0,
  logs: [],
  players: lobbyPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji || '🎴',
    chips: p.chips || STARTING_CHIPS,
    hole: [],
    roundBet: 0,
    handInvested: 0,
    status: 'ACTIVE',
    hasActed: false,
    lastAction: '',
    handEval: null
  }))
});

const startHand = (gs) => {
  gs.winners = [];
  let activeCount = 0;

  gs.players.forEach((p) => {
    if (p.chips <= 0) {
      p.status = 'ELIMINATED';
      p.chips = 0;
    } else {
      p.status = 'ACTIVE';
      p.hasActed = false;
      p.roundBet = 0;
      p.handInvested = 0;
      p.lastAction = '';
      p.handEval = null;
      p.hole = [];
      activeCount++;
    }
  });

  if (activeCount < 2) {
    gs.phase = 'FINISHED';
    gs.message = 'Partida finalizada.';
    addLog(gs, '🏆 PARTIDA FINALIZADA.');
    return gs;
  }

  gs.handCount++;

  // Only escalate blinds in non-fixed rooms
  if (!gs.fixedBlinds && gs.handCount > 1 && gs.handCount % 5 === 0 && gs.blindLevel < BLIND_LEVELS.length - 1) {
    gs.blindLevel++;
    const { sb, bb } = BLIND_LEVELS[gs.blindLevel];
    addLog(gs, `🔥 NIVEL ${gs.blindLevel + 1}: Ciegas ${sb}/${bb}`);
  }

  const { sb, bb } = getCurrentBlinds(gs);
  const n = gs.players.length;

  let dIdx = gs.dealerIdx < 0
    ? nextIdxFrom(gs, n - 1, (p) => p.status === 'ACTIVE')
    : nextIdxFrom(gs, gs.dealerIdx, (p) => p.status === 'ACTIVE');
  if (dIdx === -1) dIdx = 0;
  gs.dealerIdx = dIdx;

  const activeIndexes = gs.players
    .map((p, idx) => (p.status === 'ACTIVE' ? idx : -1))
    .filter((idx) => idx !== -1);

  const headsUp = activeIndexes.length === 2;
  const sbIdx = headsUp ? dIdx : nextIdxFrom(gs, dIdx, (p) => p.status === 'ACTIVE');
  const bbIdx = headsUp
    ? activeIndexes.find((idx) => idx !== dIdx)
    : nextIdxFrom(gs, sbIdx, (p) => p.status === 'ACTIVE');

  gs.deck = shuffle(createDeck());
  gs.board = [];
  gs.pot = 0;

  gs.players.forEach((p) => {
    if (p.status === 'ACTIVE') p.hole = [gs.deck.pop(), gs.deck.pop()];
  });

  addLog(gs, `--- Mano #${gs.handCount} (${sb}/${bb}) ---`);

  const postBlind = (idx, amount, note) => {
    const p = gs.players[idx];
    const posted = commitChips(gs, p, amount);
    p.lastAction = note;
    addLog(gs, `${p.emoji} ${p.name} pone ${note} ($${posted})`);
    return posted;
  };

  const sbPosted = postBlind(sbIdx, sb, 'Ciega Pequena');
  const bbPosted = postBlind(bbIdx, bb, 'Ciega Grande');

  gs.highestBet = Math.max(sbPosted, bbPosted);
  gs.lastFullRaiseSize = bb;
  gs.minRaiseTo = gs.highestBet + gs.lastFullRaiseSize;
  gs.phase = 'PREFLOP';
  gs.message = 'Repartiendo cartas...';

  const firstToAct = headsUp
    ? sbIdx
    : nextIdxFrom(gs, bbIdx, isActionable);

  if (firstToAct === -1) {
    addLog(gs, '▶ Avance rapido (todos all-in)');
    while (gs.phase !== 'SHOWDOWN') gs = advancePhase(gs);
    return gs;
  }

  gs.turnIdx = firstToAct;
  return gs;
};

const evaluateShowdown = (gs) => {
  gs.phase = 'SHOWDOWN';
  addLog(gs, '--- SHOWDOWN ---');

  const unfolded = gs.players.filter(isInHand);
  unfolded.forEach((p) => { p.handEval = evaluateBestHand(p.hole, gs.board); });

  const remaining = gs.players.map((p) => ({
    id: p.id,
    invested: p.handInvested,
    status: p.status,
    handEval: p.handEval,
    name: p.name,
    emoji: p.emoji
  }));

  gs.winners = [];
  const winMessages = [];
  let potsProcessed = 0;
  const n = gs.players.length;

  while (unfolded.some((p) => remaining.find((r) => r.id === p.id)?.invested > 0)) {
    const activeInvests = remaining.filter((r) => isInHand(r) && r.invested > 0);
    if (!activeInvests.length) break;

    const minInvest = Math.min(...activeInvests.map((r) => r.invested));
    let potAmount = 0;
    const eligible = [];

    remaining.forEach((r) => {
      if (r.invested <= 0) return;
      const toTake = Math.min(r.invested, minInvest);
      r.invested -= toTake;
      potAmount += toTake;
      if (isInHand(r) && toTake === minInvest) eligible.push(r);
    });

    let bestScore = [-1, -1, -1, -1, -1, -1];
    let potWinners = [];

    eligible.forEach((ep) => {
      const cmp = compareScores(ep.handEval?.score, bestScore);
      if (cmp > 0) {
        bestScore = ep.handEval.score;
        potWinners = [ep];
      } else if (cmp === 0) {
        potWinners.push(ep);
      }
    });

    if (potWinners.length > 0) {
      const split = Math.floor(potAmount / potWinners.length);
      const remainder = potAmount % potWinners.length;

      const orderedWinners = [...potWinners].sort((a, b) => {
        const aIdx = gs.players.findIndex((p) => p.id === a.id);
        const bIdx = gs.players.findIndex((p) => p.id === b.id);
        const aDist = (aIdx - gs.dealerIdx + n) % n;
        const bDist = (bIdx - gs.dealerIdx + n) % n;
        return aDist - bDist;
      });

      orderedWinners.forEach((pw, i) => {
        const player = gs.players.find((p) => p.id === pw.id);
        if (player) player.chips += split + (i < remainder ? 1 : 0);
        if (!gs.winners.includes(pw.id)) gs.winners.push(pw.id);
      });

      const wNames = orderedWinners.map((w) => `${w.emoji} ${w.name}`).join(', ');
      const pName = potsProcessed === 0 ? 'Pozo Principal' : 'Pozo Secundario';
      winMessages.push(
        orderedWinners.length === 1
          ? `¡${wNames} gana ${pName} ($${potAmount}) con ${orderedWinners[0].handEval.name}!`
          : `Empate en ${pName}: ${wNames}`
      );
      addLog(gs, `💰 ${pName}: ${wNames} (+$${potAmount})`);
    }
    potsProcessed++;
  }

  gs.pot = 0;
  gs.message = winMessages.join(' | ') || 'Mano terminada';
  return gs;
};

const advancePhase = (gs) => {
  const { bb } = getCurrentBlinds(gs);
  gs.players.forEach((p) => {
    p.roundBet = 0;
    p.hasActed = false;
    p.lastAction = '';
  });
  gs.highestBet = 0;
  gs.lastFullRaiseSize = bb;
  gs.minRaiseTo = bb;

  if (gs.phase === 'PREFLOP') {
    gs.phase = 'FLOP';
    const [c1, c2, c3] = [gs.deck.pop(), gs.deck.pop(), gs.deck.pop()];
    gs.board.push(c1, c2, c3);
    gs.message = 'Ronda de Flop';
    addLog(gs, `♠ Flop: ${c1.value}${c1.suit} ${c2.value}${c2.suit} ${c3.value}${c3.suit}`);
  } else if (gs.phase === 'FLOP') {
    gs.phase = 'TURN';
    const c = gs.deck.pop();
    gs.board.push(c);
    gs.message = 'Ronda de Turn';
    addLog(gs, `♠ Turn: ${c.value}${c.suit}`);
  } else if (gs.phase === 'TURN') {
    gs.phase = 'RIVER';
    const c = gs.deck.pop();
    gs.board.push(c);
    gs.message = 'Ronda de River';
    addLog(gs, `♠ River: ${c.value}${c.suit}`);
  } else if (gs.phase === 'RIVER') {
    return evaluateShowdown(gs);
  }

  if (gs.phase !== 'SHOWDOWN') {
    const next = nextIdxFrom(gs, gs.dealerIdx, isActionable);
    if (next !== -1) gs.turnIdx = next;
  }
  return gs;
};

const handleAction = (gs, playerId, type, amount = 0) => {
  if (['WAITING', 'SHOWDOWN', 'FINISHED'].includes(gs.phase)) return gs;

  const currentPlayer = gs.players[gs.turnIdx];
  if (!currentPlayer || currentPlayer.id !== playerId || !isActionable(currentPlayer)) return gs;

  const p = currentPlayer;
  const actionType = String(type || '').toUpperCase();
  const toCall = Math.max(0, gs.highestBet - p.roundBet);
  const rawRaise = Number.isFinite(amount) ? Math.floor(amount) : 0;
  const raiseAmount = Math.max(0, rawRaise);
  let logMsg = '';

  if (actionType === 'FOLD') {
    p.status = 'FOLDED';
    p.lastAction = 'No va';
    logMsg = `${p.emoji} ${p.name} se retira.`;
  } else if (actionType === 'CHECK') {
    if (toCall > 0) return gs;
    p.lastAction = 'Pasa';
    logMsg = `${p.emoji} ${p.name} pasa.`;
  } else if (actionType === 'CALL') {
    const called = commitChips(gs, p, toCall);
    p.lastAction = toCall > 0 ? 'Iguala' : 'Pasa';
    logMsg = toCall > 0 ? `${p.emoji} ${p.name} iguala $${called}.` : `${p.emoji} ${p.name} pasa.`;
    if (p.status === 'ALL_IN') logMsg = `${p.emoji} ${p.name} va ALL-IN ($${p.handInvested}).`;
  } else if (actionType === 'RAISE') {
    const minFullRaise = Math.max(gs.lastFullRaiseSize || getCurrentBlinds(gs).bb, 1);
    const requestedTotal = toCall + raiseAmount;

    if (requestedTotal <= toCall) {
      if (toCall === 0) return gs;
      const called = commitChips(gs, p, toCall);
      p.lastAction = p.status === 'ALL_IN' ? 'All-In' : 'Iguala';
      logMsg = p.status === 'ALL_IN'
        ? `${p.emoji} ${p.name} va ALL-IN ($${p.handInvested}).`
        : `${p.emoji} ${p.name} iguala $${called}.`;
    } else {
      const maxContribution = p.chips;
      const actualContribution = Math.min(maxContribution, requestedTotal);
      const isAllIn = actualContribution === maxContribution;
      const newRoundBet = p.roundBet + actualContribution;
      const raiseSize = newRoundBet - gs.highestBet;

      if (raiseSize < minFullRaise && !isAllIn) return gs;

      commitChips(gs, p, actualContribution);
      gs.highestBet = p.roundBet;
      if (raiseSize >= minFullRaise) gs.lastFullRaiseSize = raiseSize;
      gs.minRaiseTo = gs.highestBet + gs.lastFullRaiseSize;
      p.lastAction = p.status === 'ALL_IN' ? 'All-In' : 'Sube';
      logMsg = p.status === 'ALL_IN'
        ? `${p.emoji} ${p.name} va ALL-IN ($${p.handInvested}).`
        : `${p.emoji} ${p.name} sube a $${p.roundBet}.`;
      gs.players.forEach((op) => {
        if (op.id !== p.id && op.status === 'ACTIVE') op.hasActed = false;
      });
    }
  } else {
    return gs;
  }

  p.hasActed = true;
  if (logMsg) addLog(gs, logMsg);

  const actingPlayers = gs.players.filter((op) => isActionable(op));
  const playersInHand = gs.players.filter((op) => isInHand(op));

  if (playersInHand.length === 1) {
    const winner = playersInHand[0];
    winner.chips += gs.pot;
    gs.pot = 0;
    gs.message = `¡${winner.emoji} ${winner.name} gana!`;
    addLog(gs, gs.message);
    gs.phase = 'SHOWDOWN';
    gs.winners = [winner.id];
    return gs;
  }

  const readyToAdvance = actingPlayers.length === 0
    || (actingPlayers.length === 1 && actingPlayers[0].hasActed && actingPlayers[0].roundBet === gs.highestBet)
    || (actingPlayers.length > 1 && actingPlayers.every((op) => op.hasActed && op.roundBet === gs.highestBet));

  if (readyToAdvance) {
    if (actingPlayers.length <= 1 && playersInHand.length >= 2) {
      addLog(gs, '▶ Avance rapido (All-In)');
      while (!['RIVER', 'SHOWDOWN'].includes(gs.phase)) gs = advancePhase(gs);
      if (gs.phase === 'RIVER') gs = advancePhase(gs);
    } else {
      gs = advancePhase(gs);
    }
  } else {
    const next = nextIdxFrom(gs, gs.turnIdx, isActionable);
    if (next !== -1) gs.turnIdx = next;
  }

  return gs;
};

module.exports = { createGameState, startHand, handleAction, STARTING_CHIPS };
