const { evaluateBestHand } = require('./handEvaluator');

const VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14 };

// ── Pre-flop hand strength (0-1) ──────────────────────────────────────────────
function preFlopStrength(hole) {
  const [c1, c2] = hole;
  if (!c1 || !c2) return 0.3;
  const v1 = VALUES[c1.value] || 7;
  const v2 = VALUES[c2.value] || 7;
  const hi = Math.max(v1, v2);
  const lo = Math.min(v1, v2);
  const isPair  = v1 === v2;
  const suited  = c1.suit === c2.suit;
  const gap     = hi - lo;

  if (isPair) return Math.min(1, 0.47 + ((hi - 2) / 12) * 0.53);  // 22=0.47 … AA=1.0

  let s = ((hi - 2) / 12) * 0.65 + ((lo - 2) / 12) * 0.25;
  if (suited)   s += 0.06;
  if (gap === 1) s += 0.07;
  else if (gap === 2) s += 0.03;
  else if (gap >= 4)  s -= 0.03 * Math.min(gap - 3, 3);
  if (hi === 14 && lo < 8 && !suited) s -= 0.04;  // weak ace penalty

  return Math.min(0.95, Math.max(0.06, s));
}

// ── Post-flop hand strength (0-1) ─────────────────────────────────────────────
function postFlopStrength(hole, board) {
  if (!board || board.length === 0) return preFlopStrength(hole);

  const result  = evaluateBestHand(hole, board);
  const rank    = result.score[0] / 8;                          // 0-1 from hand rank
  const topCard = (result.score[1] || 0) / 14 * 0.07;          // tiebreaker bonus

  // Draw detection (adds equity when board not complete)
  let draw = 0;
  if (board.length < 5) {
    const all = [...hole, ...board];

    // Flush draw: 4 of same suit in 4-card set
    const suitCount = {};
    all.forEach(c => { suitCount[c.suit] = (suitCount[c.suit] || 0) + 1; });
    if (Object.values(suitCount).some(n => n === 4)) draw += 0.14;

    // Straight draw: 4 consecutive values
    const uVals = [...new Set(all.map(c => VALUES[c.value] || 0))].sort((a, b) => a - b);
    let run = 1, maxRun = 1;
    for (let i = 1; i < uVals.length; i++) {
      run = uVals[i] - uVals[i-1] === 1 ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    if (maxRun >= 4 && rank < 0.45) draw += 0.11;  // only counts as bonus if not already strong
  }

  return Math.min(1, rank + topCard + draw);
}

// ── Bot personalities ──────────────────────────────────────────────────────────
// aggression: how often/large to raise (0-1)
// bluffFreq:  probability of bluffing a weak hand
// callLoose:  extra % beyond pot odds to call
const PERSONALITIES = {
  tag:   { aggression: 0.72, bluffFreq: 0.08, callLoose: 0.04 }, // Tight-Aggressive  ← best long-run
  lag:   { aggression: 0.90, bluffFreq: 0.18, callLoose: 0.14 }, // Loose-Aggressive  ← dangerous
  gto:   { aggression: 0.65, bluffFreq: 0.22, callLoose: 0.07 }, // GTO-balanced      ← tricky
  shark: { aggression: 0.80, bluffFreq: 0.12, callLoose: 0.06 }, // Shark hybrid
};

const BOT_TEMPLATES = [
  { name: 'RoboCop',  emoji: '🤖', style: 'tag'   },
  { name: 'DeepBlue', emoji: '🦾', style: 'gto'   },
  { name: 'Magnus',   emoji: '🧠', style: 'lag'   },
  { name: 'Matrix',   emoji: '👾', style: 'shark' },
  { name: 'Nexus',    emoji: '⚡', style: 'gto'   },
];

function createBots(count) {
  const n = Math.min(count, BOT_TEMPLATES.length);
  return BOT_TEMPLATES.slice(0, n).map((t, i) => ({
    id: `bot_${i}_${Date.now()}`,
    name: t.name,
    emoji: t.emoji,
    isBot: true,
    personality: PERSONALITIES[t.style],
  }));
}

// ── Bet sizing ────────────────────────────────────────────────────────────────
function calcBetSize(gs, bot, strength, personality) {
  const pot    = Math.max(gs.pot, 1);
  const bb     = gs.fixedBlinds?.bb || 20;
  const toCall = gs.highestBet - bot.roundBet;
  const minBet = Math.max(bb, (gs.highestBet || bb) * 2 - bot.roundBet);

  // Pot fraction scales with strength + aggression (0.4x – 1.1x pot)
  const frac   = 0.4 + strength * personality.aggression * 0.7;
  const sized  = Math.floor(pot * frac);
  const capped = Math.min(bot.chips, Math.max(minBet, sized));

  return capped;
}

// ── Main decision function ─────────────────────────────────────────────────────
function decideBotAction(gs, botMeta) {
  const bot = gs.players.find(p => p.id === botMeta.id);
  if (!bot || !['ACTIVE'].includes(bot.status)) return { type: 'FOLD' };

  const toCall   = Math.max(0, gs.highestBet - bot.roundBet);
  const pot      = Math.max(gs.pot, 1);
  const active   = gs.players.filter(p => p.status === 'ACTIVE' || p.status === 'ALL_IN').length;
  const pers     = botMeta.personality;

  // Raw hand strength
  const rawStr   = postFlopStrength(bot.hole, gs.board);

  // Multi-way penalty: more players = need stronger hand
  const mpPenalty = (active - 2) * 0.04;
  const adjStr   = Math.max(0, rawStr - mpPenalty);

  // Pot odds: minimum equity needed to call profitably
  const potOdds  = toCall > 0 ? toCall / (pot + toCall) : 0;

  // Position bonus: BTN/CO plays wider
  const posOffset = (gs.players.indexOf(bot) - gs.dealerIdx + gs.players.length) % gs.players.length;
  const posBonus  = posOffset <= 1 ? 0.05 : 0;

  // Bluff decision
  const tryBluff  = Math.random() < pers.bluffFreq
                    && adjStr < 0.32
                    && toCall < pot * 0.45;  // don't bluff into huge pots

  const effStr    = tryBluff ? 0.62 : adjStr + posBonus;

  // Stack-to-pot ratio: be more cautious when SPR > 10
  const spr       = bot.chips / pot;
  const sizeBonus = spr < 3 ? 0.08 : 0;  // willing to go all-in when short

  const finalStr  = Math.min(1, effStr + sizeBonus);

  // ── Decision thresholds ────
  const callThresh  = potOdds - pers.callLoose;          // call if strength > this
  const raiseThresh = 0.54 + (1 - pers.aggression) * 0.22; // raise if strength > this

  if (toCall === 0) {
    // No bet to call: check or bet
    const betThresh = 0.48 + (1 - pers.aggression) * 0.18;
    if (finalStr > betThresh) {
      return { type: 'RAISE', amount: calcBetSize(gs, bot, finalStr, pers) };
    }
    return { type: 'CHECK' };
  }

  // There is a bet to call
  if (finalStr > raiseThresh && bot.chips > toCall * 2) {
    return { type: 'RAISE', amount: calcBetSize(gs, bot, finalStr, pers) };
  }
  if (finalStr >= callThresh) {
    return { type: 'CALL' };
  }
  return { type: 'FOLD' };
}

module.exports = { createBots, decideBotAction };
