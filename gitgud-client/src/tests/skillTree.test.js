/**
 * skillTree.test.js
 * TDD unit tests for skill tree business logic.
 *
 * Run: npx vitest run src/tests/skillTree.test.js
 * (uses existing vitest setup from the project)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Pure function imports (no Firestore needed) ───────────────────────────────
import {
  calculateExp,
  applyFiftyFifty,
  applyReveal1Wrong,
  canTryAgain,
  getPassivePerks,
  getActivePerks,
} from '../skilltree/skillTreeEngine'

import {
  PERK_KEY,
  SKILL_TYPE,
  skillPointsForLevel,
  SKILL_NODES,
  SKILL_MAP,
} from '../skilltree/skillTreeData'

// ── Mock Firestore so engine imports don't blow up in test env ────────────────
vi.mock('../firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  runTransaction: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
}))

// ─────────────────────────────────────────────────────────────────────────────
// skillTreeData
// ─────────────────────────────────────────────────────────────────────────────
describe('skillTreeData', () => {
  it('has a start node at level 0', () => {
    const start = SKILL_NODES.find(n => n.id === 'start')
    expect(start).toBeDefined()
    expect(start.level).toBe(0)
    expect(start.parentIds).toHaveLength(0)
  })

  it('has exactly 2 level-1 nodes', () => {
    const l1 = SKILL_NODES.filter(n => n.level === 1)
    expect(l1).toHaveLength(2)
  })

  it('has exactly 4 level-2 nodes', () => {
    const l2 = SKILL_NODES.filter(n => n.level === 2)
    expect(l2).toHaveLength(4)
  })

  it('has exactly 4 level-3 nodes', () => {
    const l3 = SKILL_NODES.filter(n => n.level === 3)
    expect(l3).toHaveLength(4)
  })

  it('every node (except start) has at least one parent', () => {
    SKILL_NODES.filter(n => n.id !== 'start').forEach(n => {
      expect(n.parentIds.length).toBeGreaterThan(0)
    })
  })

  it('SKILL_MAP contains every node id', () => {
    SKILL_NODES.forEach(n => {
      expect(SKILL_MAP[n.id]).toBeDefined()
    })
  })

  it('skillPointsForLevel: level 1 → 0, level 2 → 1, level 5 → 4', () => {
    expect(skillPointsForLevel(1)).toBe(0)
    expect(skillPointsForLevel(2)).toBe(1)
    expect(skillPointsForLevel(5)).toBe(4)
  })

  it('all nodes have required fields', () => {
    SKILL_NODES.forEach(n => {
      expect(n).toHaveProperty('id')
      expect(n).toHaveProperty('label')
      expect(n).toHaveProperty('description')
      expect(n).toHaveProperty('type')
      expect(n).toHaveProperty('level')
      expect(n).toHaveProperty('icon')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// calculateExp
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateExp', () => {
  it('returns base exp with no perks', () => {
    expect(calculateExp(10, [], [], 0)).toBe(10)
  })

  it('EXP +10% adds 10% to base', () => {
    // 10 * 1.10 = 11
    expect(calculateExp(10, [PERK_KEY.EXP_10], [], 0)).toBe(11)
  })

  it('EXP perks are additive: +10% + +50% + +100% = +160%', () => {
    // 10 * 2.6 = 26
    const perks = [PERK_KEY.EXP_10, PERK_KEY.EXP_50, PERK_KEY.EXP_100]
    expect(calculateExp(10, perks, [], 0)).toBe(26)
  })

  it('triple chain does NOT activate below 2 consecutive correct', () => {
    expect(calculateExp(10, [PERK_KEY.TRIPLE_EXP_CHAIN], [], 1)).toBe(10)
  })

  it('triple chain activates at 2 consecutive correct (+3x multiplier)', () => {
    // base=10, multiplier 1+3=4, result=40
    expect(calculateExp(10, [PERK_KEY.TRIPLE_EXP_CHAIN], [], 2)).toBe(40)
  })

  it('double or nothing always adds +2x multiplier', () => {
    // base=10, multiplier 1+2=3, result=30
    expect(calculateExp(10, [PERK_KEY.DOUBLE_OR_NOTHING], [], 0)).toBe(30)
  })

  it('multipliers are additive: triple(+3) + double(+2) = +5x', () => {
    // base=10, multiplier 1+3+2=6, result=60
    const perks = [PERK_KEY.TRIPLE_EXP_CHAIN, PERK_KEY.DOUBLE_OR_NOTHING]
    expect(calculateExp(10, perks, [], 2)).toBe(60)
  })

  it('flat bonus + multiplier combine correctly', () => {
    // flat: 10*(1+0.1)=11, multiplier: 1+2=3, result: 11*3=33
    const perks = [PERK_KEY.EXP_10, PERK_KEY.DOUBLE_OR_NOTHING]
    expect(calculateExp(10, perks, [], 0)).toBe(33)
  })

  it('full stack: all exp perks + all multipliers at chain 2', () => {
    // flat: 10*2.6=26, multiplier: 1+3+2=6, result: 26*6=156
    const perks = [
      PERK_KEY.EXP_10, PERK_KEY.EXP_50, PERK_KEY.EXP_100,
      PERK_KEY.TRIPLE_EXP_CHAIN, PERK_KEY.DOUBLE_OR_NOTHING,
    ]
    expect(calculateExp(10, perks, [], 2)).toBe(156)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// applyFiftyFifty
// ─────────────────────────────────────────────────────────────────────────────
describe('applyFiftyFifty', () => {
  const wrongIndices = [0, 1, 3]
  const correctIndex = 2

  it('hides exactly 2 wrong choices in standard 50/50', () => {
    const result = applyFiftyFifty(wrongIndices, correctIndex, [PERK_KEY.FIFTY_FIFTY], [PERK_KEY.FIFTY_FIFTY])
    expect(result.hiddenIndices).toHaveLength(2)
    // all hidden must be wrong
    result.hiddenIndices.forEach(i => expect(wrongIndices).toContain(i))
    expect(result.revealedCorrect).toBeNull()
  })

  it('coin toss reveals 1 correct + 1 wrong and hides nothing', () => {
    const result = applyFiftyFifty(
      wrongIndices,
      correctIndex,
      [PERK_KEY.FIFTY_FIFTY, PERK_KEY.COIN_TOSS],
      [PERK_KEY.FIFTY_FIFTY, PERK_KEY.COIN_TOSS]
    )
    expect(result.hiddenIndices).toHaveLength(0)
    expect(result.revealedCorrect).toBe(correctIndex)
    expect(wrongIndices).toContain(result.revealedWrong)
  })

  it('coin toss does not activate without COIN_TOSS in unlockedPerks', () => {
    const result = applyFiftyFifty(
      wrongIndices,
      correctIndex,
      [PERK_KEY.FIFTY_FIFTY],         // no coin toss unlocked
      [PERK_KEY.FIFTY_FIFTY, PERK_KEY.COIN_TOSS]
    )
    expect(result.hiddenIndices).toHaveLength(2) // standard 50/50
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// applyReveal1Wrong
// ─────────────────────────────────────────────────────────────────────────────
describe('applyReveal1Wrong', () => {
  it('returns one of the wrong indices', () => {
    const wrongIndices = [0, 1, 3]
    const result = applyReveal1Wrong(wrongIndices)
    expect(wrongIndices).toContain(result)
  })

  it('works when only 1 wrong index', () => {
    expect(applyReveal1Wrong([3])).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// canTryAgain
// ─────────────────────────────────────────────────────────────────────────────
describe('canTryAgain', () => {
  it('returns false without TRY_AGAIN perk', () => {
    expect(canTryAgain([PERK_KEY.EXP_10])).toBe(false)
  })

  it('returns true with TRY_AGAIN perk', () => {
    expect(canTryAgain([PERK_KEY.TRY_AGAIN])).toBe(true)
  })

  it('returns false with empty array', () => {
    expect(canTryAgain([])).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getPassivePerks / getActivePerks
// ─────────────────────────────────────────────────────────────────────────────
describe('getPassivePerks', () => {
  it('returns only passive perks that are unlocked', () => {
    const unlocked = [PERK_KEY.EXP_10, PERK_KEY.FIFTY_FIFTY, PERK_KEY.EXP_50]
    const passives = getPassivePerks(unlocked)
    passives.forEach(p => {
      expect(p.type).toBe(SKILL_TYPE.PASSIVE)
      expect(unlocked).toContain(p.id)
    })
    const ids = passives.map(p => p.id)
    expect(ids).toContain(PERK_KEY.EXP_10)
    expect(ids).toContain(PERK_KEY.EXP_50)
    expect(ids).not.toContain(PERK_KEY.FIFTY_FIFTY) // active
  })
})

describe('getActivePerks', () => {
  it('returns only active perks that are unlocked', () => {
    const unlocked = [PERK_KEY.FIFTY_FIFTY, PERK_KEY.EXP_10]
    const actives = getActivePerks(unlocked)
    actives.forEach(p => {
      expect(p.type).toBe(SKILL_TYPE.ACTIVE)
      expect(unlocked).toContain(p.id)
    })
    const ids = actives.map(p => p.id)
    expect(ids).toContain(PERK_KEY.FIFTY_FIFTY)
    expect(ids).not.toContain(PERK_KEY.EXP_10) // passive
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: prerequisite chain validation (simulated)
// ─────────────────────────────────────────────────────────────────────────────
describe('prerequisite chain', () => {
  const isUnlocked = (id, unlockedPerks) => unlockedPerks.includes(id) || id === 'start'
  const prereqsMet = (perkId, unlockedPerks) => {
    const node = SKILL_MAP[perkId]
    return node.parentIds.every(pid => isUnlocked(pid, unlockedPerks))
  }

  it('L1 perks available immediately (only need start)', () => {
    expect(prereqsMet(PERK_KEY.FIFTY_FIFTY, [])).toBe(true)
    expect(prereqsMet(PERK_KEY.EXP_10, [])).toBe(true)
  })

  it('L2 perks NOT available without L1 parent', () => {
    expect(prereqsMet(PERK_KEY.REVEAL_1_WRONG, [])).toBe(false)
    expect(prereqsMet(PERK_KEY.EXP_50, [])).toBe(false)
  })

  it('L2 perks available with correct L1 parent', () => {
    expect(prereqsMet(PERK_KEY.REVEAL_1_WRONG, [PERK_KEY.FIFTY_FIFTY])).toBe(true)
    expect(prereqsMet(PERK_KEY.EXP_50, [PERK_KEY.EXP_10])).toBe(true)
  })

  it('L3 perks require correct L2 parent', () => {
    expect(prereqsMet(PERK_KEY.COIN_TOSS, [PERK_KEY.REVEAL_1_WRONG])).toBe(true)
    expect(prereqsMet(PERK_KEY.COIN_TOSS, [PERK_KEY.RETRY_QUESTION])).toBe(false)
    expect(prereqsMet(PERK_KEY.TRY_AGAIN, [PERK_KEY.RETRY_QUESTION])).toBe(true)
    expect(prereqsMet(PERK_KEY.EXP_100, [PERK_KEY.EXP_50])).toBe(true)
    expect(prereqsMet(PERK_KEY.DOUBLE_OR_NOTHING, [PERK_KEY.TRIPLE_EXP_CHAIN])).toBe(true)
  })
})
