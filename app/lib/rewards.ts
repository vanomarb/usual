export interface StampCard {
  /** Stamps on the current card, 0 to 8. */
  stamps: number
  /** Free drinks earned and not used yet. */
  free: number
}

/** Nine stamps fill a card and earn the tenth drink free. */
export const STAMPS_PER_CARD = 9

export function addStamp(card: StampCard): StampCard {
  const stamps = card.stamps + 1
  return stamps >= STAMPS_PER_CARD ? { stamps: 0, free: card.free + 1 } : { stamps, free: card.free }
}

export function redeem(card: StampCard): StampCard {
  return { stamps: card.stamps, free: Math.max(0, card.free - 1) }
}

export interface OrderStamps {
  card: StampCard
  stamps: number
  earnedFree: boolean
  /** Why the stamp line reads as it does: stamps added, the free drink covered the only drink, or no drinks at all. */
  note: 'stamps' | 'free-only' | 'no-drinks'
}

/** Bites never earn a stamp; a free drink covers one drink, which earns none. */
export function settleOrder(card: StampCard, order: { drinks: number; usedFree: boolean }): OrderStamps {
  const afterRedeem = order.usedFree ? redeem(card) : card
  const stamps = Math.max(0, order.drinks - (order.usedFree ? 1 : 0))
  let next = afterRedeem
  for (let i = 0; i < stamps; i++) next = addStamp(next)
  return {
    card: next,
    stamps,
    earnedFree: next.free > afterRedeem.free,
    note: order.drinks === 0 ? 'no-drinks' : stamps === 0 ? 'free-only' : 'stamps',
  }
}

export function cardWords(card: StampCard): { progress: string; note: string } {
  if (card.free > 0) {
    return {
      progress: card.free > 1 ? `${card.free} free drinks waiting` : 'A free drink is waiting',
      note: 'A free drink is waiting. Tick “Use my free drink” on your next order.',
    }
  }
  const left = STAMPS_PER_CARD - card.stamps
  return {
    progress: `${card.stamps} of ${STAMPS_PER_CARD} stamps`,
    note: card.stamps === 0 ? 'No stamps yet. Your first drink ordered ahead adds one.' : left === 1 ? 'One more stamp to a free drink.' : `${left} more stamps to a free drink.`,
  }
}
