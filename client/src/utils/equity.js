import { evaluateBestHand, compareScores } from './handEval.js'

const SUITS = ['♥', '♦', '♣', '♠']
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

const getNumericValue = (val) => {
  if (val === 'J') return 11; if (val === 'Q') return 12
  if (val === 'K') return 13; if (val === 'A') return 14
  return parseInt(val)
}

const fullDeck = SUITS.flatMap(suit =>
  VALUES.map(value => ({ suit, value, numValue: getNumericValue(value) }))
)

const cardKey = c => `${c.value}${c.suit}`

export const calculateEquity = (myCards, boardCards, numOpponents = 1, sims = 250) => {
  if (myCards.length < 2 || numOpponents < 1) return null

  const known = new Set([...myCards, ...boardCards].map(cardKey))
  const deck = fullDeck.filter(c => !known.has(cardKey(c)))

  let wins = 0, ties = 0

  for (let i = 0; i < sims; i++) {
    // Shuffle remaining deck (Fisher-Yates partial)
    const d = [...deck]
    const need = (5 - boardCards.length) + numOpponents * 2
    for (let j = 0; j < need; j++) {
      const r = j + Math.floor(Math.random() * (d.length - j))
      ;[d[j], d[r]] = [d[r], d[j]]
    }

    const boardNeeded = 5 - boardCards.length
    const simBoard = [...boardCards, ...d.slice(0, boardNeeded)]
    const myEval = evaluateBestHand(myCards, simBoard)

    let bestOppScore = [-Infinity]
    for (let j = 0; j < numOpponents; j++) {
      const oppCards = d.slice(boardNeeded + j * 2, boardNeeded + j * 2 + 2)
      if (oppCards.length < 2) continue
      const oppEval = evaluateBestHand(oppCards, simBoard)
      if (compareScores(oppEval.score, bestOppScore) > 0) bestOppScore = oppEval.score
    }

    const cmp = compareScores(myEval.score, bestOppScore)
    if (cmp > 0) wins++
    else if (cmp === 0) ties++
  }

  return {
    win: Math.round((wins / sims) * 100),
    tie: Math.round((ties / sims) * 100),
    lose: Math.round(((sims - wins - ties) / sims) * 100)
  }
}
