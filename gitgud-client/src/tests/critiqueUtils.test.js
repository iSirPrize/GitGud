// critiqueUtils.test.js
// Drop into: gitgud-client/src/tests/critiqueUtils.test.js
//
// TDD approach: tests define expected behaviour of each utility.
// Run with: npm test
//
// User Story covered:
//   "As a user, I would like to link videos I have uploaded on YouTube,
//    so that the community can critique and give me advice."
//
// Acceptance criteria verified:
//   - Valid YouTube links are accepted and embedded
//   - Invalid links are rejected with clear error messages
//   - Posts require a title and category before submission
//   - Like/dislike toggling works correctly and is mutually exclusive
//   - Timestamps display in human-readable relative format
//   - Quiz submissions enforce the 30-second clip limit
//   - Answer shuffling always preserves the correct answer

import { describe, it, expect } from 'vitest'
import {
  extractYouTubeId,
  buildEmbedUrl,
  validateCritiqueForm,
  computeReaction,
  formatRelativeTime,
  validateQuizForm,
  shuffleAnswers,
} from '../critiqueUtils'

// ─────────────────────────────────────────────────────────────────────────────
// extractYouTubeId
// ─────────────────────────────────────────────────────────────────────────────
describe('extractYouTubeId', () => {
  it('extracts ID from a standard watch URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('dQw4w9WgXcQ')
  })

  it('extracts ID from a shortened youtu.be URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ'))
      .toBe('dQw4w9WgXcQ')
  })

  it('extracts ID from an embed URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'))
      .toBe('dQw4w9WgXcQ')
  })

  it('accepts a raw 11-character video ID', () => {
    expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for a completely invalid URL', () => {
    expect(extractYouTubeId('https://www.google.com')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(extractYouTubeId('')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(extractYouTubeId(null)).toBeNull()
  })

  it('handles URLs with extra query parameters', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'))
      .toBe('dQw4w9WgXcQ')
  })

  it('trims whitespace before parsing', () => {
    expect(extractYouTubeId('  https://youtu.be/dQw4w9WgXcQ  '))
      .toBe('dQw4w9WgXcQ')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildEmbedUrl
// ─────────────────────────────────────────────────────────────────────────────
describe('buildEmbedUrl', () => {
  it('builds a correct embed URL from a video ID', () => {
    expect(buildEmbedUrl('dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1')
  })

  it('returns null for null input', () => {
    expect(buildEmbedUrl(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(buildEmbedUrl('')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateCritiqueForm
// ─────────────────────────────────────────────────────────────────────────────
describe('validateCritiqueForm', () => {
  const valid = {
    ytUrl:    'https://youtu.be/dQw4w9WgXcQ',
    title:    'What did I do wrong in this 1v1?',
    category: 'wrong',
  }

  it('returns no errors for a valid submission', () => {
    expect(validateCritiqueForm(valid)).toEqual({})
  })

  it('returns an error when YouTube URL is invalid', () => {
    const errors = validateCritiqueForm({ ...valid, ytUrl: 'not-a-url' })
    expect(errors.ytUrl).toBeDefined()
  })

  it('returns an error when title is empty', () => {
    const errors = validateCritiqueForm({ ...valid, title: '' })
    expect(errors.title).toBeDefined()
  })

  it('returns an error when title is whitespace only', () => {
    const errors = validateCritiqueForm({ ...valid, title: '   ' })
    expect(errors.title).toBeDefined()
  })

  it('returns an error when title exceeds 120 characters', () => {
    const errors = validateCritiqueForm({ ...valid, title: 'a'.repeat(121) })
    expect(errors.title).toBeDefined()
  })

  it('accepts a title of exactly 120 characters', () => {
    const errors = validateCritiqueForm({ ...valid, title: 'a'.repeat(120) })
    expect(errors.title).toBeUndefined()
  })

  it('returns an error when category is missing', () => {
    const errors = validateCritiqueForm({ ...valid, category: '' })
    expect(errors.category).toBeDefined()
  })

  it('returns an error for an unrecognised category', () => {
    const errors = validateCritiqueForm({ ...valid, category: 'memes' })
    expect(errors.category).toBeDefined()
  })

  it('accepts the "highlight" category', () => {
    const errors = validateCritiqueForm({ ...valid, category: 'highlight' })
    expect(errors.category).toBeUndefined()
  })

  it('returns multiple errors when multiple fields are invalid', () => {
    const errors = validateCritiqueForm({ ytUrl: '', title: '', category: '' })
    expect(Object.keys(errors).length).toBeGreaterThan(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeReaction
// ─────────────────────────────────────────────────────────────────────────────
describe('computeReaction', () => {
  const uid = 'user-123'

  it('adds a like when the user has not yet liked', () => {
    const result = computeReaction({ likes: [], dislikes: [] }, uid, 'like')
    expect(result.likes).toContain(uid)
    expect(result.dislikes).not.toContain(uid)
  })

  it('removes a like when the user has already liked (toggle off)', () => {
    const result = computeReaction({ likes: [uid], dislikes: [] }, uid, 'like')
    expect(result.likes).not.toContain(uid)
  })

  it('adds a dislike when the user has not yet disliked', () => {
    const result = computeReaction({ likes: [], dislikes: [] }, uid, 'dislike')
    expect(result.dislikes).toContain(uid)
    expect(result.likes).not.toContain(uid)
  })

  it('removes a dislike when the user has already disliked (toggle off)', () => {
    const result = computeReaction({ likes: [], dislikes: [uid] }, uid, 'dislike')
    expect(result.dislikes).not.toContain(uid)
  })

  it('switches from dislike to like and removes the dislike', () => {
    const result = computeReaction({ likes: [], dislikes: [uid] }, uid, 'like')
    expect(result.likes).toContain(uid)
    expect(result.dislikes).not.toContain(uid)
  })

  it('switches from like to dislike and removes the like', () => {
    const result = computeReaction({ likes: [uid], dislikes: [] }, uid, 'dislike')
    expect(result.dislikes).toContain(uid)
    expect(result.likes).not.toContain(uid)
  })

  it('does not modify other users reactions', () => {
    const otherUid = 'other-user'
    const result = computeReaction({ likes: [otherUid], dislikes: [] }, uid, 'like')
    expect(result.likes).toContain(otherUid)
    expect(result.likes).toContain(uid)
  })

  it('returns unchanged arrays when uid is null', () => {
    const initial = { likes: ['abc'], dislikes: [] }
    const result = computeReaction(initial, null, 'like')
    expect(result.likes).toEqual(initial.likes)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// formatRelativeTime
// ─────────────────────────────────────────────────────────────────────────────
describe('formatRelativeTime', () => {
  const now = new Date('2026-05-12T12:00:00Z')

  it('shows "just now" for dates less than 60 seconds ago', () => {
    const date = new Date('2026-05-12T11:59:30Z')
    expect(formatRelativeTime(date, now)).toBe('just now')
  })

  it('shows minutes ago for dates between 1 and 59 minutes ago', () => {
    const date = new Date('2026-05-12T11:45:00Z')
    expect(formatRelativeTime(date, now)).toBe('15m ago')
  })

  it('shows hours ago for dates between 1 and 23 hours ago', () => {
    const date = new Date('2026-05-12T09:00:00Z')
    expect(formatRelativeTime(date, now)).toBe('3h ago')
  })

  it('shows a date string for dates older than 24 hours', () => {
    const date = new Date('2026-05-10T12:00:00Z')
    const result = formatRelativeTime(date, now)
    expect(typeof result).toBe('string')
    expect(result).not.toBe('just now')
    expect(result).not.toContain('ago')
  })

  it('returns empty string for invalid date', () => {
    expect(formatRelativeTime(new Date('invalid'), now)).toBe('')
  })

  it('shows "just now" for a future date', () => {
    const future = new Date('2026-05-12T13:00:00Z')
    expect(formatRelativeTime(future, now)).toBe('just now')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateQuizForm
// ─────────────────────────────────────────────────────────────────────────────
describe('validateQuizForm', () => {
  const valid = {
    ytUrl:         'https://youtu.be/dQw4w9WgXcQ',
    pauseAt:       '8',
    question:      'What is the best play here?',
    correctAnswer: 'Peek with blastpack',
    fakeAnswers:   ['Retreat', 'Full eco', 'Wait for teammate'],
    reason:        'Blastpacking disrupts crosshair placement.',
    game:          'valorant',
  }

  it('returns no errors for a fully valid quiz form', () => {
    expect(validateQuizForm(valid)).toEqual({})
  })

  it('rejects a pause point of 0', () => {
    expect(validateQuizForm({ ...valid, pauseAt: '0' }).pauseAt).toBeDefined()
  })

  it('rejects a pause point greater than 30 seconds', () => {
    expect(validateQuizForm({ ...valid, pauseAt: '31' }).pauseAt).toBeDefined()
  })

  it('accepts a pause point of exactly 30 seconds', () => {
    expect(validateQuizForm({ ...valid, pauseAt: '30' }).pauseAt).toBeUndefined()
  })

  it('rejects a question shorter than 10 characters', () => {
    expect(validateQuizForm({ ...valid, question: 'Short?' }).question).toBeDefined()
  })

  it('rejects when correct answer is empty', () => {
    expect(validateQuizForm({ ...valid, correctAnswer: '' }).correctAnswer).toBeDefined()
  })

  it('rejects when fewer than 3 fake answers provided', () => {
    expect(validateQuizForm({ ...valid, fakeAnswers: ['only one', ''] }).fakeAnswers).toBeDefined()
  })

  it('rejects when a fake answer is blank', () => {
    expect(validateQuizForm({ ...valid, fakeAnswers: ['Retreat', '', 'Full eco'] }).fakeAnswers).toBeDefined()
  })

  it('rejects an unrecognised game', () => {
    expect(validateQuizForm({ ...valid, game: 'fortnite' }).game).toBeDefined()
  })

  it('accepts cs2 as a valid game', () => {
    expect(validateQuizForm({ ...valid, game: 'cs2' }).game).toBeUndefined()
  })

  it('accepts other as a valid game', () => {
    expect(validateQuizForm({ ...valid, game: 'other' }).game).toBeUndefined()
  })

  it('rejects missing reason/explanation', () => {
    expect(validateQuizForm({ ...valid, reason: '' }).reason).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// shuffleAnswers
// ─────────────────────────────────────────────────────────────────────────────
describe('shuffleAnswers', () => {
  const correct = 'Peek with blastpack'
  const fakes   = ['Retreat', 'Full eco', 'Wait for teammate']

  it('returns an array of 4 choices', () => {
    const { choices } = shuffleAnswers(correct, fakes)
    expect(choices.length).toBe(4)
  })

  it('includes the correct answer in the choices', () => {
    const { choices } = shuffleAnswers(correct, fakes)
    expect(choices).toContain(correct)
  })

  it('includes all fake answers in the choices', () => {
    const { choices } = shuffleAnswers(correct, fakes)
    fakes.forEach((f) => expect(choices).toContain(f))
  })

  it('correctIndex points to the correct answer', () => {
    const { choices, correctIndex } = shuffleAnswers(correct, fakes)
    expect(choices[correctIndex]).toBe(correct)
  })

  it('correctIndex is always within bounds', () => {
    for (let i = 0; i < 20; i++) {
      const { choices, correctIndex } = shuffleAnswers(correct, fakes)
      expect(correctIndex).toBeGreaterThanOrEqual(0)
      expect(correctIndex).toBeLessThan(choices.length)
    }
  })

  it('with a fixed random function puts correct answer at a predictable position', () => {
    // Always returns 0 — no swaps happen, correct stays at index 0
    const noShuffle = () => 0
    const { choices, correctIndex } = shuffleAnswers(correct, fakes, noShuffle)
    expect(choices[correctIndex]).toBe(correct)
  })
})
