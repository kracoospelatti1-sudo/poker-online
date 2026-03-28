const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const getNumericValue = (val) => {
  if (val === 'J') return 11;
  if (val === 'Q') return 12;
  if (val === 'K') return 13;
  if (val === 'A') return 14;
  return parseInt(val);
};

const createDeck = () => {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value, numValue: getNumericValue(value) });
    }
  }
  return deck;
};

const shuffle = (deck) => {
  const s = [...deck];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
};

module.exports = { createDeck, shuffle };
