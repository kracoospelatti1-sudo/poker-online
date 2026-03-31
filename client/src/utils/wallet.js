const WALLET_ID_KEY = 'poker_wallet_id'
const APPLIED_MP_PAYMENTS_KEY = 'poker_mp_applied_payments'

function fallbackWalletId() {
  return `w_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`
}

export function getOrCreateWalletId() {
  let walletId = localStorage.getItem(WALLET_ID_KEY)
  if (walletId) return walletId

  walletId = (window.crypto && window.crypto.randomUUID)
    ? window.crypto.randomUUID().replace(/-/g, '').slice(0, 32)
    : fallbackWalletId()

  localStorage.setItem(WALLET_ID_KEY, walletId)
  return walletId
}

export function hasAppliedPayment(paymentId) {
  if (!paymentId) return false
  const raw = localStorage.getItem(APPLIED_MP_PAYMENTS_KEY)
  if (!raw) return false
  const list = raw.split(',').filter(Boolean)
  return list.includes(String(paymentId))
}

export function markPaymentApplied(paymentId) {
  if (!paymentId) return
  const raw = localStorage.getItem(APPLIED_MP_PAYMENTS_KEY)
  const list = raw ? raw.split(',').filter(Boolean) : []
  const asString = String(paymentId)
  if (!list.includes(asString)) list.push(asString)
  localStorage.setItem(APPLIED_MP_PAYMENTS_KEY, list.slice(-50).join(','))
}
