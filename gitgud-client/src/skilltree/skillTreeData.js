/**
 * skillTreeData.js
 * Single source of truth for all skill tree node definitions.
 * Open/Closed: add new nodes here without modifying engine logic.
 */

export const SKILL_TYPE = {
  PASSIVE: 'passive',
  ACTIVE: 'active',
};

export const PERK_KEY = {
  FIFTY_FIFTY:        'fiftyFifty',
  EXP_10:             'exp10',
  REVEAL_1_WRONG:     'reveal1Wrong',
  RETRY_QUESTION:     'retryQuestion',
  EXP_50:             'exp50',
  TRIPLE_EXP_CHAIN:   'tripleExpChain',
  COIN_TOSS:          'coinToss',
  TRY_AGAIN:          'tryAgain',
  EXP_100:            'exp100',
  DOUBLE_OR_NOTHING:  'doubleOrNothing',
  AIM_ACTIVE_1:       'aimActive1',
  AIM_ACTIVE_2:       'aimActive2',
  AIM_ACTIVE_3:       'aimActive3',
  AIM_PASSIVE_1:      'aimPassive1',
  AIM_PASSIVE_2:      'aimPassive2',
  REACTION_ACTIVE_1:  'reactionActive1',
  REACTION_ACTIVE_2:  'reactionActive2',
  REACTION_PASSIVE_1: 'reactionPassive1',
  REACTION_PASSIVE_2: 'reactionPassive2',
  REACTION_PASSIVE_3: 'reactionPassive3',
};

/**
 * Skill tree node schema:
 *  id          – unique string key (PERK_KEY)
 *  label       – short display name
 *  description – full description shown on hover / in dropdown
 *  type        – 'passive' | 'active'
 *  level       – tree depth (0 = root, 1–3 = branches)
 *  parentIds   – array of prerequisite node ids (empty for root)
 *  children    – filled in at runtime by buildTree()
 *  icon        – emoji shorthand
 */
export const SKILL_NODES = [
  {
    id: 'start',
    label: 'Start',
    description: 'Your skill tree journey begins here.',
    type: SKILL_TYPE.PASSIVE,
    level: 0,
    parentIds: [],
    icon: '★',
  },
  // ── Level 1 ────────────────────────────────────────────────────────────────
  {
    id: PERK_KEY.FIFTY_FIFTY,
    label: '50/50',
    description: 'Remove 2 wrong answers, leaving 1 wrong and 1 correct.',
    type: SKILL_TYPE.ACTIVE,
    level: 1,
    parentIds: ['start'],
    icon: '½',
  },
  {
    id: PERK_KEY.EXP_10,
    label: 'EXP +10%',
    description: 'Passively gain 10% more EXP on every correct quiz answer.',
    type: SKILL_TYPE.PASSIVE,
    level: 1,
    parentIds: ['start'],
    icon: '📈',
  },

  {
    id: PERK_KEY.REACTION_PASSIVE_1,
    label: 'Reaction XP +10%',
    description: 'Gain 10% more XP from Reaction Trainer.',
    type: SKILL_TYPE.PASSIVE,
    level: 1,
    parentIds: ['start'],
    icon: '📈',
  },

  {
    id: PERK_KEY.AIM_ACTIVE_1,
    label: 'Larger Targets',
    description: 'Enlarge your targets in Aim Trainer, making them easier to hit.',
    type: SKILL_TYPE.ACTIVE,
    level: 1,
    parentIds: ['start'],
    icon: '🎯',
  },

  // ── Level 2 ────────────────────────────────────────────────────────────────
  {
    id: PERK_KEY.REVEAL_1_WRONG,
    label: 'Reveal 1 Wrong',
    description: 'Reveal one incorrect answer before you commit.',
    type: SKILL_TYPE.ACTIVE,
    level: 2,
    parentIds: [PERK_KEY.FIFTY_FIFTY],
    icon: '🚫',
  },
  {
    id: PERK_KEY.RETRY_QUESTION,
    label: 'Retry Question',
    description: 'Retry a single question once without penalty.',
    type: SKILL_TYPE.ACTIVE,
    level: 2,
    parentIds: [PERK_KEY.FIFTY_FIFTY],
    icon: '↩️',
  },
  {
    id: PERK_KEY.EXP_50,
    label: 'EXP +50%',
    description: 'Passively gain 50% more EXP on every correct answer (additive with other EXP perks).',
    type: SKILL_TYPE.PASSIVE,
    level: 2,
    parentIds: [PERK_KEY.EXP_10],
    icon: '💹',
  },
  {
    id: PERK_KEY.TRIPLE_EXP_CHAIN,
    label: '3× EXP Chain',
    description: 'After 2 consecutive correct answers, earn 3× EXP multiplier (additive).',
    type: SKILL_TYPE.PASSIVE,
    level: 2,
    parentIds: [PERK_KEY.EXP_10],
    icon: '🔥',
  },

   {
    id: PERK_KEY.AIM_ACTIVE_2,
    label: '+1 Target',
    description: 'Add +1 target to your final Aim Trainer score.',
    type: SKILL_TYPE.ACTIVE,
    level: 2,
    parentIds: [PERK_KEY.AIM_ACTIVE_1],
    icon: '🎯',
  },

  {
    id: PERK_KEY.AIM_PASSIVE_1,
    label: 'Aim XP +25%',
    description: 'Gain 25% more XP from Aim Trainer.',
    type: SKILL_TYPE.PASSIVE,
    level: 2,
    parentIds: [PERK_KEY.AIM_ACTIVE_1],
    icon: '📈',
  },

  {
    id: PERK_KEY.REACTION_ACTIVE_1,
    label: '-5ms',
    description: 'Reduce your final reaction average by 5ms.',
    type: SKILL_TYPE.ACTIVE,
    level: 2,
    parentIds: [PERK_KEY.REACTION_PASSIVE_1],
    icon: '⚡',
  },

  {
    id: PERK_KEY.REACTION_PASSIVE_2,
    label: 'Reaction XP +25%',
    description: 'Gain 25% more XP from Reaction Trainer.',
    type: SKILL_TYPE.PASSIVE,
    level: 2,
    parentIds: [PERK_KEY.REACTION_PASSIVE_1],
    icon: '📈',
  },

  // ── Level 3 ────────────────────────────────────────────────────────────────
  {
    id: PERK_KEY.COIN_TOSS,
    label: 'Coin Toss',
    description: 'Reveals 1 correct + 1 wrong answer. Get it right and the perk recharges for the next question — get it wrong and it is consumed.',
    type: SKILL_TYPE.ACTIVE,
    level: 3,
    parentIds: [PERK_KEY.REVEAL_1_WRONG],
    icon: '🪙',
  },
  {
    id: PERK_KEY.TRY_AGAIN,
    label: 'Try Again',
    description: 'Reattempt the entire quiz as if it is your first attempt today.',
    type: SKILL_TYPE.ACTIVE,
    level: 3,
    parentIds: [PERK_KEY.RETRY_QUESTION],
    icon: '🔄',
  },
  {
    id: PERK_KEY.EXP_100,
    label: 'EXP +100%',
    description: 'Passively gain 100% more EXP on every correct answer (additive with other EXP perks).',
    type: SKILL_TYPE.PASSIVE,
    level: 3,
    parentIds: [PERK_KEY.EXP_50],
    icon: '⚡',
  },
  {
    id: PERK_KEY.DOUBLE_OR_NOTHING,
    label: 'Double or Nothing',
    description: '2× EXP multiplier for every correct answer (additive with Chain multiplier).',
    type: SKILL_TYPE.PASSIVE,
    level: 3,
    parentIds: [PERK_KEY.TRIPLE_EXP_CHAIN],
    icon: '🎰',
  },

  {
    id: PERK_KEY.AIM_ACTIVE_3,
    label: '+3 Targets',
    description: 'Add +3 targets to your final Aim Trainer score.',
    type: SKILL_TYPE.ACTIVE,
    level: 3,
    parentIds: [PERK_KEY.AIM_ACTIVE_2],
    icon: '🏹',
  },  

  {
    id: PERK_KEY.AIM_PASSIVE_2,
    label: 'Aim XP +50%',
    description: 'Gain 50% more XP from Aim Trainer.',
    type: SKILL_TYPE.PASSIVE,
    level: 3,
    parentIds: [PERK_KEY.AIM_PASSIVE_1],
    icon: '🔥',
  },

  {
    id: PERK_KEY.REACTION_ACTIVE_2,
    label: '-10ms',
    description: 'Reduce your final reaction average by 10ms.',
    type: SKILL_TYPE.ACTIVE,
    level: 3,
    parentIds: [PERK_KEY.REACTION_ACTIVE_1],
    icon: '🔥',
  },

  {
    id: PERK_KEY.REACTION_PASSIVE_3,
    label: 'Reaction XP +50%',
    description: 'Gain 50% more XP from Reaction Trainer.',
    type: SKILL_TYPE.PASSIVE,
    level: 3,
    parentIds: [PERK_KEY.REACTION_PASSIVE_2],
    icon: '🚀',
  },
];

/** Build a quick lookup map: id → node */
export const SKILL_MAP = Object.fromEntries(SKILL_NODES.map(n => [n.id, n]));

/** Level thresholds — must stay in sync with usePoints.js */
export const LEVEL_THRESHOLDS = [0, 100, 500, 1500, 4000, 10000];

/**
 * How many skill points a user has available at a given level.
 * Level 1 → 0 points, Level 2 → 1 point, etc.
 */
export function skillPointsForLevel(level) {
  return Math.max(0, level - 1);
}
