// critiqueUtils.js
// Drop into: gitgud-client/src/critiqueUtils.js
//
// Pure utility functions for the User Critique feature.
// Extracted so they can be unit-tested without Firebase or DOM dependencies.

// ── YouTube URL / ID utilities ────────────────────────────────────────────────

/**
 * Extracts a YouTube video ID from a URL or raw ID string.
 * Supports:
 *   https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *   https://youtu.be/dQw4w9WgXcQ
 *   https://www.youtube.com/embed/dQw4w9WgXcQ
 *   dQw4w9WgXcQ  (raw 11-char ID)
 * Returns null if no valid ID found.
 */
export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ]
  for (const pattern of patterns) {
    const match = trimmed.match(pattern)
    if (match) return match[1]
  }
  return null
}

/**
 * Builds the YouTube embed URL from a video ID.
 */
export function buildEmbedUrl(videoId) {
  if (!videoId) return null
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
}

// ── Critique post validation ──────────────────────────────────────────────────

/**
 * Validates a critique post submission form.
 * Returns an object of field -> error message.
 * Empty object means valid.
 *
 * @param {{ ytUrl: string, title: string, category: string }} fields
 */
export function validateCritiqueForm({ ytUrl = '', title = '', category = '' } = {}) {
  const errors = {}

  const videoId = extractYouTubeId(ytUrl)
  if (!videoId) {
    errors.ytUrl = 'Enter a valid YouTube URL or video ID.'
  }

  if (!title.trim()) {
    errors.title = 'Give your post a title.'
  } else if (title.trim().length > 120) {
    errors.title = 'Title must be 120 characters or fewer.'
  }

  const validCategories = ['wrong', 'highlight']
  if (!category || !validCategories.includes(category)) {
    errors.category = 'Select a category.'
  }

  return errors
}

// ── Like / dislike toggle logic ───────────────────────────────────────────────

/**
 * Computes the next likes/dislikes arrays after a user reaction.
 *
 * @param {{ likes: string[], dislikes: string[] }} current - current arrays
 * @param {string} uid - the reacting user's ID
 * @param {'like'|'dislike'} type - the reaction type
 * @returns {{ likes: string[], dislikes: string[] }}
 */
export function computeReaction({ likes = [], dislikes = [] }, uid, type) {
  if (!uid) return { likes, dislikes }

  let nextLikes    = [...likes]
  let nextDislikes = [...dislikes]

  if (type === 'like') {
    if (nextLikes.includes(uid)) {
      // Toggle off
      nextLikes = nextLikes.filter((id) => id !== uid)
    } else {
      // Add like, remove any existing dislike
      nextLikes    = [...nextLikes.filter((id) => id !== uid), uid]
      nextDislikes = nextDislikes.filter((id) => id !== uid)
    }
  } else if (type === 'dislike') {
    if (nextDislikes.includes(uid)) {
      // Toggle off
      nextDislikes = nextDislikes.filter((id) => id !== uid)
    } else {
      // Add dislike, remove any existing like
      nextDislikes = [...nextDislikes.filter((id) => id !== uid), uid]
      nextLikes    = nextLikes.filter((id) => id !== uid)
    }
  }

  return { likes: nextLikes, dislikes: nextDislikes }
}

// ── Relative timestamp ────────────────────────────────────────────────────────

/**
 * Returns a human-readable relative time string from a Date object.
 * Used in CritiquePost to show post age.
 *
 * @param {Date} date
 * @param {Date} [now] - injectable for testing
 */
export function formatRelativeTime(date, now = new Date()) {
  if (!(date instanceof Date) || isNaN(date)) return ''
  const diffSeconds = Math.floor((now - date) / 1000)
  if (diffSeconds < 0)    return 'just now'
  if (diffSeconds < 60)   return 'just now'
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`
  return date.toLocaleDateString()
}

// ── Quiz submission validation (User Quiz feature) ────────────────────────────

/**
 * Validates a user quiz submission form.
 * Returns errors object — empty means valid.
 *
 * @param {{ ytUrl: string, pauseAt: string|number, question: string,
 *           correctAnswer: string, fakeAnswers: string[], reason: string,
 *           game: string }} fields
 */
export function validateQuizForm({
  ytUrl = '',
  pauseAt = '',
  question = '',
  correctAnswer = '',
  fakeAnswers = [],
  reason = '',
  game = '',
} = {}) {
  const errors = {}

  if (!extractYouTubeId(ytUrl)) {
    errors.ytUrl = 'Enter a valid YouTube URL or video ID.'
  }

  const pa = Number(pauseAt)
  if (!pauseAt || isNaN(pa) || pa <= 0) {
    errors.pauseAt = 'Enter a positive number of seconds.'
  } else if (pa > 30) {
    errors.pauseAt = 'Pause point must be within the first 30 seconds.'
  }

  if (!question.trim()) {
    errors.question = 'Question is required.'
  } else if (question.trim().length < 10) {
    errors.question = 'Question is too short — be more specific.'
  }

  if (!correctAnswer.trim()) {
    errors.correctAnswer = 'Correct answer is required.'
  }

  if (!Array.isArray(fakeAnswers) || fakeAnswers.length < 3 || fakeAnswers.some((f) => !f.trim())) {
    errors.fakeAnswers = 'All three fake answers are required.'
  }

  if (!reason.trim()) {
    errors.reason = 'Please explain why the correct answer is right.'
  }

  const validGames = ['valorant', 'cs2', 'other']
  if (!game || !validGames.includes(game)) {
    errors.game = 'Select a game category.'
  }

  return errors
}

// ── Answer shuffler ───────────────────────────────────────────────────────────

/**
 * Shuffles an array of answers and returns { choices, correctIndex }.
 * Uses Fisher-Yates. Injectable random function for testing.
 *
 * @param {string} correct - the correct answer
 * @param {string[]} fakes - the fake answers
 * @param {() => number} [rand] - random function (default Math.random)
 */
export function shuffleAnswers(correct, fakes, rand = Math.random) {
  const all = [correct, ...fakes]
  // Fisher-Yates
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]]
  }
  return {
    choices: all,
    correctIndex: all.indexOf(correct),
  }
}
