/**
 * skillTreeEngine.js
 * Pure business-logic layer (no React, no UI).
 *
 * Responsibilities:
 *  - Load / save user skill tree state from Firestore (via transactions for thread safety)
 *  - Validate unlock attempts (prerequisites, point budget)
 *  - Calculate EXP given active perks (additive bonuses + multiplicative chain)
 *  - Provide active-perk helpers consumed by QuizCarousel
 *
 * SOLID compliance:
 *  S – only concerns skill state persistence + EXP calculation
 *  O – new perks in skillTreeData.js extend behaviour without editing this file
 *  L – functions are substitutable / pure where possible
 *  I – exported functions are fine-grained; callers import only what they need
 *  D – depends on abstract db reference injected at call-site, not hard-coded
 */

import { doc, runTransaction, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SKILL_NODES, SKILL_MAP, PERK_KEY, skillPointsForLevel } from './skillTreeData';

// ─── Firestore path helpers ───────────────────────────────────────────────────

const userSkillRef = (uid) => doc(db, 'users', uid);

// ─── State shape ──────────────────────────────────────────────────────────────
/**
 * Firestore field: users/{uid}.skillTree
 * {
 *   unlockedPerks: string[],       // perk ids that have been permanently unlocked
 *   pendingLevelUp: boolean,       // true if user levelled up and hasn't visited tree
 *   activeSessionPerks: string[],  // perks toggled ON for current quiz session (stored client-side only)
 * }
 */

// ─── Read helpers ─────────────────────────────────────────────────────────────

/** Subscribe to live skill tree state for a user. Returns unsubscribe fn. */
export function subscribeSkillTree(uid, callback) {
  return onSnapshot(userSkillRef(uid), (snap) => {
    if (!snap.exists()) {
      callback({ unlockedPerks: [], pendingLevelUp: false });
      return;
    }
    const data = snap.data();
    callback({
      unlockedPerks: data.skillTree?.unlockedPerks ?? [],
      pendingLevelUp: data.skillTree?.pendingLevelUp ?? false,
      xp: data.xp ?? 0,
      level: data.level ?? 1,
    });
  });
}

// ─── Write helpers (all use transactions for thread safety) ───────────────────

/**
 * Attempt to unlock a perk for a user.
 * Returns { success: boolean, error?: string }
 */
export async function unlockPerk(uid, perkId) {
  try {
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(userSkillRef(uid));
      const data = snap.data() ?? {};
      const currentXp = data.xp ?? 0;
      const currentLevel = data.level ?? 1;
      const skillTree = data.skillTree ?? { unlockedPerks: [], pendingLevelUp: false };
      const unlocked = skillTree.unlockedPerks ?? [];

      // Already unlocked?
      if (unlocked.includes(perkId)) {
        return { success: false, error: 'Perk already unlocked.' };
      }

      const node = SKILL_MAP[perkId];
      if (!node) return { success: false, error: 'Unknown perk.' };

      // Prerequisite check
      const prereqsMet = node.parentIds.every(pid =>
        pid === 'start' || unlocked.includes(pid)
      );
      if (!prereqsMet) {
        return { success: false, error: 'Prerequisites not met.' };
      }

      // Skill point budget
      const totalPoints = skillPointsForLevel(currentLevel);
      const spentPoints = unlocked.filter(p => p !== 'start').length;
      if (spentPoints >= totalPoints) {
        return { success: false, error: 'Not enough skill points. Level up more!' };
      }

      const newUnlocked = [...unlocked, perkId];
      tx.update(userSkillRef(uid), {
        'skillTree.unlockedPerks': newUnlocked,
        'skillTree.pendingLevelUp': false, // consumed one point
      });

      return { success: true };
    });

    return result;
  } catch (err) {
    console.error('[SkillTree] unlockPerk error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Mark pendingLevelUp = true when user levels up.
 * Called from usePoints / awardPoints path.
 * Safe to call redundantly — transaction is idempotent.
 */
export async function flagLevelUp(uid, newLevel) {
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userSkillRef(uid));
      const data = snap.data() ?? {};
      const skillTree = data.skillTree ?? {};
      const currentLevel = data.level ?? 1;

      // Only flag if level actually increased and user has a new point available
      const oldLevel = currentLevel;
      if (newLevel > oldLevel) {
        const totalPoints = skillPointsForLevel(newLevel);
        const spent = (skillTree.unlockedPerks ?? []).filter(p => p !== 'start').length;
        if (totalPoints > spent) {
          tx.update(userSkillRef(uid), { 'skillTree.pendingLevelUp': true });
        }
      }
    });
  } catch (err) {
    console.error('[SkillTree] flagLevelUp error:', err);
  }
}

/** Clear the pending level-up indicator once user opens the skill tree page. */
export async function clearLevelUpFlag(uid) {
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userSkillRef(uid));
      if (snap.exists()) {
        tx.update(userSkillRef(uid), { 'skillTree.pendingLevelUp': false });
      }
    });
  } catch (err) {
    console.error('[SkillTree] clearLevelUpFlag error:', err);
  }
}

// ─── EXP calculation ──────────────────────────────────────────────────────────

/**
 * Calculate the actual EXP to award for a correct answer.
 *
 * Rules (from spec):
 *  - Base EXP: 10 per correct answer
 *  - Additive flat bonuses: +10%, +50%, +100% of base (stacked)
 *  - Multiplicative chain: 3× and/or 2× are ADDITIVE with each other
 *    e.g. 3× + 2× = 5× multiplier
 *
 * @param {number} baseExp         – raw exp (default 10)
 * @param {string[]} unlockedPerks – user's unlocked perk ids
 * @param {string[]} activePerks   – active (toggled-on) perk ids for this session
 * @param {number} consecutiveCorrect – streak of correct answers so far
 * @returns {number} final exp to award
 */
export function calculateExp(
  baseExp = 10,
  unlockedPerks = [],
  activePerks = [],
  consecutiveCorrect = 0
) {
  const has = (perkId) => unlockedPerks.includes(perkId);

  // ── Flat additive bonus percentage ──
  let bonusPct = 0;
  if (has(PERK_KEY.EXP_10))  bonusPct += 10;
  if (has(PERK_KEY.EXP_50))  bonusPct += 50;
  if (has(PERK_KEY.EXP_100)) bonusPct += 100;

  const flatExp = baseExp * (1 + bonusPct / 100);

  // ── Multiplicative chain (additive multipliers stack) ──
  let multiplier = 1;

  if (has(PERK_KEY.TRIPLE_EXP_CHAIN) && consecutiveCorrect >= 2) {
    multiplier += 3; // adds 3×
  }
  if (has(PERK_KEY.DOUBLE_OR_NOTHING)) {
    multiplier += 2; // adds 2×
  }

  return Math.round(flatExp * multiplier);
}

// ─── Active perk helpers used by QuizCarousel ─────────────────────────────────

/**
 * Apply 50/50: returns indices of choices to hide (2 wrong ones).
 * If COIN_TOSS is also unlocked and active, it reveals 1 correct + 1 wrong instead.
 *
 * @param {number[]} wrongIndices   – indices of wrong choices (all except correctIndex)
 * @param {number}   correctIndex
 * @param {string[]} unlockedPerks
 * @param {string[]} activePerks    – which active perks are toggled on this question
 * @returns {{ hiddenIndices: number[], revealedCorrect: number|null, revealedWrong: number|null }}
 */
export function applyFiftyFifty(wrongIndices, correctIndex, unlockedPerks, activePerks) {
  const hasCoinToss = unlockedPerks.includes(PERK_KEY.COIN_TOSS) &&
                      activePerks.includes(PERK_KEY.COIN_TOSS);

  if (hasCoinToss) {
    // Coin Toss: reveal 1 correct + 1 wrong (show all, but label them)
    const revealedWrong = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
    return {
      hiddenIndices: [],
      revealedCorrect: correctIndex,
      revealedWrong,
    };
  }

  // Standard 50/50: hide 2 wrong answers
  const shuffled = [...wrongIndices].sort(() => Math.random() - 0.5);
  return {
    hiddenIndices: shuffled.slice(0, 2),
    revealedCorrect: null,
    revealedWrong: null,
  };
}

/**
 * Apply Reveal 1 Wrong: returns a single wrong index to flag.
 */
export function applyReveal1Wrong(wrongIndices) {
  return wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
}

/**
 * Check if user can use Try Again (replaces Retry Question at level 3).
 * Returns true if perk is unlocked. Session tracking handled in component.
 */
export function canTryAgain(unlockedPerks) {
  return unlockedPerks.includes(PERK_KEY.TRY_AGAIN);
}

/**
 * Get all passive perks that are permanently active (no toggle needed).
 */
export function getPassivePerks(unlockedPerks) {
  return SKILL_NODES.filter(
    n => n.type === 'passive' && unlockedPerks.includes(n.id)
  );
}

/**
 * Get all active perks the user has unlocked (require manual activation).
 */
export function getActivePerks(unlockedPerks) {
  return SKILL_NODES.filter(
    n => n.type === 'active' && unlockedPerks.includes(n.id)
  );
}
