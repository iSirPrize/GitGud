/**
 * useSkillTree.js
 * React hook that subscribes to live skill tree state and exposes
 * actions for unlocking perks and toggling active perks per quiz session.
 *
 * Interface segregation: components consume only what they need from this hook.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  subscribeSkillTree,
  unlockPerk,
  clearLevelUpFlag,
  getPassivePerks,
  getActivePerks,
  calculateExp,
} from './skillTreeEngine';
import { SKILL_MAP, PERK_KEY } from './skillTreeData';

/**
 * @param {string} uid – Firebase user id
 * @returns {{
 *   unlockedPerks: string[],
 *   pendingLevelUp: boolean,
 *   level: number,
 *   xp: number,
 *   passivePerks: SkillNode[],
 *   activePerks: SkillNode[],
 *   sessionActivePerks: string[],    // toggled on for current quiz
 *   toggleSessionPerk: fn,
 *   unlock: fn,
 *   dismissLevelUp: fn,
 *   loading: boolean,
 * }}
 */
export function useSkillTree(uid) {
  const [state, setState] = useState({
    unlockedPerks: [],
    pendingLevelUp: false,
    level: 1,
    xp: 0,
    loading: true,
  });

  // Active perks toggled on for the current quiz session (client-side only)
  const [sessionActivePerks, setSessionActivePerks] = useState([]);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeSkillTree(uid, (data) => {
      setState({ ...data, loading: false });
    });
    return () => unsub();
  }, [uid]);

  /** Toggle an active perk on/off for the current quiz session */
  const toggleSessionPerk = useCallback((perkId) => {
    const node = SKILL_MAP[perkId];
    if (!node || node.type !== 'active') return;
    setSessionActivePerks(prev =>
      prev.includes(perkId)
        ? prev.filter(p => p !== perkId)
        : [...prev, perkId]
    );
  }, []);

  /** Attempt to unlock a perk in Firestore */
  const unlock = useCallback(async (perkId) => {
    if (!uid) return { success: false, error: 'Not logged in.' };
    return unlockPerk(uid, perkId);
  }, [uid]);

  /** Called when user opens the skill tree page — clears red notification dot */
  const dismissLevelUp = useCallback(async () => {
    if (!uid) return;
    await clearLevelUpFlag(uid);
  }, [uid]);

  /** Reset session perks (call at quiz start or quiz complete) */
  const resetSessionPerks = useCallback(() => {
    setSessionActivePerks([]);
  }, []);

  const passivePerks = getPassivePerks(state.unlockedPerks);
  const activePerks  = getActivePerks(state.unlockedPerks);

  return {
    ...state,
    passivePerks,
    activePerks,
    sessionActivePerks,
    toggleSessionPerk,
    unlock,
    dismissLevelUp,
    resetSessionPerks,
  };
}

/**
 * Convenience hook for quiz page EXP calculation.
 * @param {string[]} unlockedPerks
 * @param {string[]} sessionActivePerks
 * @returns {{ getExp: fn(baseExp, consecutiveCorrect) => number }}
 */
export function useSkillExp(unlockedPerks, sessionActivePerks) {
  const getExp = useCallback(
    (baseExp = 10, consecutiveCorrect = 0) =>
      calculateExp(baseExp, unlockedPerks, sessionActivePerks, consecutiveCorrect),
    [unlockedPerks, sessionActivePerks]
  );
  return { getExp };
}
