// adminQuizUtils.js
// Pure utility functions for the Admin Quiz system.
//
// Design principles:
//   S – Single Responsibility: each function does exactly one thing
//   O – Open/Closed: question types are a discriminated union — add a new type
//       by adding to QUESTION_TYPES and writing a validator, not by modifying
//       existing validators
//   L – Liskov: all validators share the same signature (form) => errors{}
//   I – Interface Segregation: players and creators import only what they need
//   D – Dependency Inversion: components depend on these abstractions, not on
//       Firebase or React directly
//
// TDD: every exported function has a corresponding test in
//   src/tests/adminQuizUtils.test.js

// ── Supported game IDs ────────────────────────────────────────────────────────
export const VALID_GAMES = ["valorant", "cs2", "other"];

// ── Question type identifiers ─────────────────────────────────────────────────
export const QUESTION_TYPES = {
  VIDEO_MC:     "video_mc",
  MULTI_CHOICE: "multi_choice",
  RANK:         "rank",
  ENTER_VALUE:  "enter_value",
};

// ── YouTube helpers ───────────────────────────────────────────────────────────

/**
 * Extract an 11-character YouTube video ID from a URL or raw ID.
 * Returns null if input is invalid.
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const trimmed = String(url).trim();
  const patterns = [
    // Standard watch URL — catches ?v= with any extra params (&t=, &list=, etc.)
    /[?&]v=([A-Za-z0-9_-]{11})/,
    // youtu.be short link
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    // /embed/, /shorts/, /live/ paths
    /youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/,
    // Raw 11-char ID only
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  return null;
}

// ── Value-question answer normaliser ─────────────────────────────────────────

/**
 * Strip currency symbols and extra whitespace, then return lower-cased string.
 * Allows matching "$4000", "4000", "4,000", "4 grenades", "4grenades".
 *
 * Strategy (Open/Closed):
 *   We extract every contiguous numeric sequence and compare it to the
 *   correct answer's numeric sequence. Text comparisons are done after
 *   collapsing whitespace. This covers all described cases without a
 *   special-case chain.
 */
export function normaliseValueAnswer(raw) {
  if (raw === null || raw === undefined) return "";
  return String(raw)
    .toLowerCase()
    .replace(/[$£€¥]/g, "")
    .replace(/,/g, "")
    .trim();
}

/**
 * Extract all digit sequences from a normalised string.
 */
export function extractNumbers(normalised) {
  const matches = normalised.match(/\d+/g);
  return matches ? matches.join("") : "";
}

/**
 * Check whether a player's typed answer is correct for an enter_value question.
 * Returns true if:
 *   (a) the numeric component matches, OR
 *   (b) the full normalised strings match exactly.
 *
 * @param {string} playerAnswer  - what the user typed
 * @param {string} correctAnswer - what the admin set
 */
export function isValueAnswerCorrect(playerAnswer, correctAnswer) {
  const normPlayer  = normaliseValueAnswer(playerAnswer);
  const normCorrect = normaliseValueAnswer(correctAnswer);
  if (normPlayer === normCorrect) return true;
  const numPlayer  = extractNumbers(normPlayer);
  const numCorrect = extractNumbers(normCorrect);
  return numPlayer.length > 0 && numPlayer === numCorrect;
}

// ── Ranking helpers ───────────────────────────────────────────────────────────

/**
 * Given an array of item indices in the order the player dragged them,
 * and the admin's correct ranking (also array of indices),
 * return true if the player's order matches exactly.
 */
export function isRankingCorrect(playerOrder, correctOrder) {
  if (!Array.isArray(playerOrder) || !Array.isArray(correctOrder)) return false;
  if (playerOrder.length !== correctOrder.length) return false;
  return playerOrder.every((v, i) => v === correctOrder[i]);
}

// ── Question validators (Liskov — same signature) ────────────────────────────

function validateVideoMcQuestion(q, index) {
  const errors = {};
  const prefix = `q${index}`;
  // Accept either a resolved videoId or a ytUrl that can be parsed (handles timing race)
  const hasVideo = q.videoId || extractYouTubeId(q.ytUrl);
  if (!hasVideo) errors[`${prefix}_ytUrl`] = "Valid YouTube URL or video ID is required.";
  const pa = Number(q.pauseAt);
  if (!q.pauseAt || isNaN(pa) || pa <= 0) errors[`${prefix}_pauseAt`] = "Enter a positive pause point in seconds.";
  if (!q.question?.trim()) errors[`${prefix}_question`] = "Question text is required.";
  if (!Array.isArray(q.choices) || q.choices.length < 2)
    errors[`${prefix}_choices`] = "At least 2 choices are required.";
  else if (q.choices.some((c) => !c?.trim()))
    errors[`${prefix}_choices`] = "All choice fields must be filled in.";
  if (q.correctIndex === null || q.correctIndex === undefined || q.correctIndex < 0)
    errors[`${prefix}_correctIndex`] = "Select the correct answer.";
  if (!q.reason?.trim()) errors[`${prefix}_reason`] = "Explanation is required.";
  return errors;
}

function validateMultiChoiceQuestion(q, index) {
  const errors = {};
  const prefix = `q${index}`;
  if (!q.question?.trim()) errors[`${prefix}_question`] = "Question text is required.";
  if (!Array.isArray(q.choices) || q.choices.length < 2)
    errors[`${prefix}_choices`] = "At least 2 choices are required.";
  else if (q.choices.some((c) => !c?.trim()))
    errors[`${prefix}_choices`] = "All choice fields must be filled in.";
  if (q.correctIndex === null || q.correctIndex === undefined || q.correctIndex < 0)
    errors[`${prefix}_correctIndex`] = "Select the correct answer.";
  if (!q.reason?.trim()) errors[`${prefix}_reason`] = "Explanation is required.";
  return errors;
}

function validateRankQuestion(q, index) {
  const errors = {};
  const prefix = `q${index}`;
  if (!q.question?.trim()) errors[`${prefix}_question`] = "Question text is required.";
  if (!Array.isArray(q.items) || q.items.length < 2)
    errors[`${prefix}_items`] = "At least 2 items are required for a ranking question.";
  else if (q.items.some((item) => !item?.label?.trim()))
    errors[`${prefix}_items`] = "All item labels must be filled in.";
  if (q.useImages) {
    const missing = q.items.some((item) => !item?.imageUrl?.trim());
    if (missing) errors[`${prefix}_images`] = "All items must have an image URL when image mode is on.";
  }
  if (!Array.isArray(q.correctOrder) || q.correctOrder.length !== q.items?.length)
    errors[`${prefix}_correctOrder`] = "Correct ranking order must be set.";
  if (!q.reason?.trim()) errors[`${prefix}_reason`] = "Explanation is required.";
  return errors;
}

function validateEnterValueQuestion(q, index) {
  const errors = {};
  const prefix = `q${index}`;
  if (!q.question?.trim()) errors[`${prefix}_question`] = "Question text is required.";
  if (!q.correctAnswer?.trim()) errors[`${prefix}_correctAnswer`] = "Correct answer is required.";
  if (!q.reason?.trim()) errors[`${prefix}_reason`] = "Explanation is required.";
  return errors;
}

// ── Dispatch map (Open/Closed — add a new type here only) ───────────────────
const QUESTION_VALIDATORS = {
  [QUESTION_TYPES.VIDEO_MC]:    validateVideoMcQuestion,
  [QUESTION_TYPES.MULTI_CHOICE]: validateMultiChoiceQuestion,
  [QUESTION_TYPES.RANK]:         validateRankQuestion,
  [QUESTION_TYPES.ENTER_VALUE]:  validateEnterValueQuestion,
};

// ── Full admin quiz form validator ────────────────────────────────────────────

/**
 * Validate an entire admin quiz form.
 *
 * @param {{ title: string, game: string, questions: Array }} form
 * @returns {{ [key: string]: string }} - empty object means valid
 */
export function validateAdminQuizForm(form) {
  const errors = {};

  if (!form?.title?.trim()) errors.title = "Quiz title is required.";
  if (!VALID_GAMES.includes(form?.game)) errors.game = "Select a valid game.";
  if (!Array.isArray(form?.questions) || form.questions.length === 0)
    errors.questions = "Add at least one question.";

  (form?.questions ?? []).forEach((q, i) => {
    const validator = QUESTION_VALIDATORS[q?.type];
    if (!validator) {
      errors[`q${i}_type`] = "Unknown question type.";
      return;
    }
    Object.assign(errors, validator(q, i));
  });

  return errors;
}

// ── Default question factories (Factory pattern) ─────────────────────────────

export function makeVideoMcQuestion() {
  return {
    type:         QUESTION_TYPES.VIDEO_MC,
    ytUrl:        "",
    videoId:      null,
    videoTitle:   "",
    pauseAt:      "",
    question:     "",
    choices:      ["", "", "", ""],
    correctIndex: null,
    reason:       "",
  };
}

export function makeMultiChoiceQuestion() {
  return {
    type:         QUESTION_TYPES.MULTI_CHOICE,
    imageUrl:     "",
    question:     "",
    choices:      ["", "", "", ""],
    correctIndex: null,
    reason:       "",
  };
}

export function makeRankQuestion() {
  return {
    type:             QUESTION_TYPES.RANK,
    contextImageUrl:  "",   // optional situation/map image shown above the question
    question:         "",
    useImages:        false,
    items:            [
      { label: "", imageUrl: "" },
      { label: "", imageUrl: "" },
      { label: "", imageUrl: "" },
      { label: "", imageUrl: "" },
    ],
    correctOrder: [0, 1, 2, 3], // admin sets this; default = creation order
    reason:       "",
  };
}

export function makeEnterValueQuestion() {
  return {
    type:          QUESTION_TYPES.ENTER_VALUE,
    question:      "",
    correctAnswer: "",
    reason:        "",
  };
}

// ── Score calculator ──────────────────────────────────────────────────────────

/**
 * Calculate player score from answers array.
 * Each entry: { type, playerAnswer, correctAnswer/correctIndex/correctOrder }
 * Returns { correct: number, total: number, points: number }
 */
export function calculateScore(answers) {
  let correct = 0;
  for (const a of answers) {
    if (a.type === QUESTION_TYPES.VIDEO_MC || a.type === QUESTION_TYPES.MULTI_CHOICE) {
      if (a.playerAnswer === a.correctIndex) correct++;
    } else if (a.type === QUESTION_TYPES.ENTER_VALUE) {
      if (isValueAnswerCorrect(a.playerAnswer, a.correctAnswer)) correct++;
    } else if (a.type === QUESTION_TYPES.RANK) {
      if (isRankingCorrect(a.playerAnswer, a.correctOrder)) correct++;
    }
  }
  return { correct, total: answers.length, points: correct * 10 };
}
