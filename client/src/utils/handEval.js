const getCombinations = (array, size) => {
  const result = []
  const p = (t, i) => {
    if (t.length === size) { result.push(t); return }
    if (i + 1 <= array.length) { p([...t, array[i]], i + 1); p(t, i + 1) }
  }
  p([], 0)
  return result
}

const evaluate5 = (hand) => {
  if (!hand || hand.length === 0) return { score: [0,0,0,0,0,0], name: 'Nada' }
  const values = hand.map(c => c.numValue).sort((a, b) => b - a)
  const suits = hand.map(c => c.suit)

  const isFlush = suits.length === 5 && suits.every(s => s === suits[0])
  let isStraight = values.length === 5 && values.every((v, i) => i === 0 || v === values[i - 1] - 1)
  let straightValues = [...values]

  if (!isStraight && values.length === 5 && values.join(',') === '14,5,4,3,2') {
    isStraight = true; straightValues = [5, 4, 3, 2, 1]
  }

  const counts = {}
  values.forEach(v => counts[v] = (counts[v] || 0) + 1)
  const freqs = Object.entries(counts)
    .map(([v, c]) => ({ v: Number(v), c }))
    .sort((a, b) => b.c - a.c || b.v - a.v)

  const f1 = freqs[0]?.c || 0, f2 = freqs[1]?.c || 0
  const v = freqs.map(f => f.v)
  while (v.length < 5) v.push(0)

  if (isFlush && isStraight && straightValues[0] === 14) return { score: [9, ...straightValues], name: 'Escalera Real' }
  if (isFlush && isStraight) return { score: [8, ...straightValues], name: 'Escalera de Color' }
  if (f1 === 4) return { score: [7, v[0], v[1], 0, 0, 0], name: 'Póker' }
  if (f1 === 3 && f2 === 2) return { score: [6, v[0], v[1], 0, 0, 0], name: 'Full House' }
  if (isFlush) return { score: [5, ...values], name: 'Color' }
  if (isStraight) return { score: [4, ...straightValues], name: 'Escalera' }
  if (f1 === 3) return { score: [3, v[0], v[1], v[2], 0, 0], name: 'Trío' }
  if (f1 === 2 && f2 === 2) return { score: [2, v[0], v[1], v[2], 0, 0], name: 'Doble Par' }
  if (f1 === 2) return { score: [1, v[0], v[1], v[2], v[3], 0], name: 'Par' }
  return { score: [0, ...values], name: 'Carta Alta' }
}

export const evaluateBestHand = (holeCards, boardCards) => {
  const allCards = [...holeCards, ...boardCards]
  if (!allCards.length) return { score: [0,0,0,0,0,0], name: 'Nada' }
  if (allCards.length <= 5) return evaluate5(allCards)
  const combos = getCombinations(allCards, 5)
  let bestScore = [-1], bestName = ''
  for (const combo of combos) {
    const { score, name } = evaluate5(combo)
    let better = false
    for (let i = 0; i < 6; i++) {
      if (score[i] > (bestScore[i] ?? -1)) { better = true; break }
      if (score[i] < (bestScore[i] ?? -1)) break
    }
    if (better) { bestScore = score; bestName = name }
  }
  return { score: bestScore, name: bestName }
}

export const compareScores = (s1, s2) => {
  for (let i = 0; i < 6; i++) {
    if (s1[i] > s2[i]) return 1
    if (s1[i] < s2[i]) return -1
  }
  return 0
}
