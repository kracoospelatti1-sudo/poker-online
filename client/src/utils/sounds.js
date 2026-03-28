let audioCtx = null

const ctx = () => {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)() } catch (e) {}
  }
  return audioCtx
}

const tone = (freq, dur, type = 'sine', vol = 0.3, delay = 0) => {
  const c = ctx()
  if (!c) return
  try {
    if (c.state === 'suspended') c.resume()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, c.currentTime + delay)
    gain.gain.setValueAtTime(vol, c.currentTime + delay)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur)
    osc.start(c.currentTime + delay)
    osc.stop(c.currentTime + delay + dur + 0.01)
  } catch (e) {}
}

export const sounds = {
  card:    () => { tone(1100, 0.06, 'triangle', 0.15); tone(750, 0.09, 'triangle', 0.08, 0.05) },
  chips:   () => { for (let i = 0; i < 4; i++) tone(820 + i * 60, 0.08, 'triangle', 0.10, i * 0.04) },
  fold:    () => { tone(380, 0.18, 'sine', 0.15); tone(260, 0.22, 'sine', 0.08, 0.14) },
  win:     () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'sine', 0.28, i * 0.1)) },
  tick:    () => tone(1100, 0.04, 'square', 0.07),
  warn:    () => { tone(880, 0.09, 'square', 0.20); tone(660, 0.09, 'square', 0.13, 0.14) },
  newHand: () => { [420, 530].forEach((f, i) => tone(f, 0.14, 'triangle', 0.18, i * 0.09)) },
  check:   () => tone(600, 0.1, 'triangle', 0.10),
}
