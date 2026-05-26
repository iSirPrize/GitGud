// useDailies.js
//
// Owns the entire daily quest system: the quest pool, selection logic,
// progress tracking, XP rewards, and Firestore persistence.
//
// STORAGE STRATEGY
// Rather than a subcollection (which would require new Firestore security rules),
// daily quest data is stored as a nested field on the existing user document:
//   users/{uid}.dailies["YYYY-MM-DD"] = { quests: [...], date: "YYYY-MM-DD" }
// This keeps the feature within the rules already granted to the user doc.

import { useState, useEffect } from "react"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "./firebase"
import { awardPoints } from "./usePoints"

// ─── Quest Pool ───────────────────────────────────────────────────────────────
// 10 quests across 3 activity types. Each day, 3 are selected deterministically
// from this pool (same day = same 3 quests for every user).
//
// Fields:
//   id        — stable identifier used in tests and Firestore
//   type      — which activity feeds this quest ("aim" | "quiz" | "reaction")
//   metric    — what stat to check within that activity
//   threshold — minimum value required (0 means any value qualifies)
//   required  — how many times the condition must be met to complete the quest
//   xpReward  — XP granted on completion via awardPoints()

export const QUEST_POOL = [
  { id: "aim_acc_70",   type: "aim",      metric: "accuracy", threshold: 70, label: "Get ≥70% accuracy in Aim Trainer",     required: 1, xpReward: 30 },
  { id: "aim_acc_80",   type: "aim",      metric: "accuracy", threshold: 80, label: "Get ≥80% accuracy in Aim Trainer",     required: 1, xpReward: 50 },
  { id: "aim_sess_1",   type: "aim",      metric: "session",  threshold: 0,  label: "Complete an Aim Trainer session",      required: 1, xpReward: 20 },
  { id: "aim_sess_2",   type: "aim",      metric: "session",  threshold: 0,  label: "Complete 2 Aim Trainer sessions",      required: 2, xpReward: 40 },
  { id: "quiz_q_3",     type: "quiz",     metric: "correct",  threshold: 0,  label: "Answer 3 quiz questions correctly",    required: 3, xpReward: 30 },
  { id: "quiz_q_5",     type: "quiz",     metric: "correct",  threshold: 0,  label: "Answer 5 quiz questions correctly",    required: 5, xpReward: 50 },
  { id: "quiz_pass_60", type: "quiz",     metric: "passgame", threshold: 60, label: "Score ≥60% on a full quiz",            required: 1, xpReward: 40 },
  { id: "quiz_pass_80", type: "quiz",     metric: "passgame", threshold: 80, label: "Score ≥80% on a full quiz",            required: 1, xpReward: 60 },
  { id: "react_sess_1", type: "reaction", metric: "session",  threshold: 0,  label: "Complete a Reaction Trainer session",  required: 1, xpReward: 20 },
  { id: "react_sess_2", type: "reaction", metric: "session",  threshold: 0,  label: "Complete 2 Reaction Trainer sessions", required: 2, xpReward: 40 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns today's date as "YYYY-MM-DD" in local time.
// Used as the Firestore field key so quests reset automatically each day —
// yesterday's key is simply never written to again.
export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ─── Pure: deterministic daily selection ─────────────────────────────────────
// Converts a date string into a numeric seed via djb2-style hashing, then uses
// that seed to drive a Fisher-Yates shuffle of the pool. Slicing the first 3
// after the shuffle gives a consistent, non-repeating selection for any given day.
//
// Deterministic = same date always produces the same 3 quests, which means all
// users see identical dailies — fair for comparison and easy to reason about.
// Known limitation: the shuffle isn't cryptographically uniform (low-index quests
// have a slightly higher selection probability), but for a game feature this is fine.

function hashDate(dateStr) {
  let h = 5381
  for (let i = 0; i < dateStr.length; i++) h = (h * 33) ^ dateStr.charCodeAt(i)
  return Math.abs(h)
}

export function pickDailyQuests(dateStr = todayKey()) {
  const seed = hashDate(dateStr)
  const pool = [...QUEST_POOL]               // copy so the original is never mutated
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (seed * (i + 7919)) % (i + 1) // prime multiplier widens the spread
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}

// ─── Pure: progress logic (exported for unit tests) ──────────────────────────

// A quest is complete once its progress count reaches the required threshold.
export function isQuestComplete(quest) {
  return quest.progress >= quest.required
}

// Returns the quest's XP reward only if it's complete; 0 otherwise.
// Prevents partial XP being awarded for incomplete quests.
export function calcQuestXP(quest) {
  return isQuestComplete(quest) ? quest.xpReward : 0
}

// Returns a new quest object with progress incremented by `amount`.
// Immutable — never mutates the original quest.
// Guards:
//   - Already-done quests are returned unchanged (idempotent)
//   - Progress is capped at `required` so it can never exceed the goal
export function applyProgress(quest, amount) {
  if (quest.done) return quest
  const newProgress = Math.min(quest.progress + amount, quest.required)
  return { ...quest, progress: newProgress, done: newProgress >= quest.required }
}

// ─── Hook: useDailies ─────────────────────────────────────────────────────────
// Loads today's quests on mount (creating them if it's the user's first visit
// today) and exposes recordProgress for activity components to report game events.
//
// Called directly inside AimGame, ReactionGame, and QuizCarousel — no prop
// threading or wrapper components needed.

export function useDailies(uid) {
  const [quests, setQuests]   = useState([])
  const [loading, setLoading] = useState(true)
  const dateKey = todayKey() // computed once on mount; changes on next page load after midnight

  // ── Load or initialise today's quests ──────────────────────────────────────
  useEffect(() => {
    if (!uid) { setLoading(false); return } // auth not ready yet — don't hang

    const ref = doc(db, "users", uid)

    getDoc(ref).then((snap) => {
      if (!snap.exists()) { setLoading(false); return }

      const todayData = snap.data().dailies?.[dateKey]

      if (todayData?.quests?.length) {
        // Returning visit today — restore saved progress
        setQuests(todayData.quests)
      } else {
        // First visit today — generate fresh quests with zero progress
        const fresh = pickDailyQuests(dateKey).map((q) => ({
          ...q, progress: 0, done: false, rewarded: false,
        }))
        // Write only to the dated nested field; no other user data is touched
        updateDoc(ref, { [`dailies.${dateKey}`]: { quests: fresh, date: dateKey } })
        setQuests(fresh)
      }
      setLoading(false)
    }).catch((err) => {
      console.error("useDailies: failed to load daily quests", err)
      setLoading(false)
    })
  }, [uid, dateKey])

  // ── Record game activity against active quests ─────────────────────────────
  // Called by activity components after a game event (session end, correct answer, etc.)
  // type    : "aim" | "quiz" | "reaction"
  // payload : { accuracy?, correct?, passPct?, session? }
  //
  // For each quest that matches the activity type and isn't already done:
  //   1. Calculate how much to increment based on the payload
  //   2. Apply the increment (immutably, via applyProgress)
  //   3. If the quest just completed, award XP once via awardPoints()
  //   4. Persist the updated quest list back to the user doc

  const recordProgress = async (type, payload) => {
    if (!uid || quests.length === 0) return

    const ref = doc(db, "users", uid)

    const updated = await Promise.all(quests.map(async (q) => {
      if (q.type !== type || q.done) return q // skip unrelated or already-done quests

      // Determine how much progress this event contributes to this specific quest
      let increment = 0
      if (type === "aim") {
        if (q.metric === "session")                                     increment = 1
        if (q.metric === "accuracy" && payload.accuracy >= q.threshold) increment = 1
      }
      if (type === "quiz") {
        if (q.metric === "correct")                                           increment = payload.correct ?? 0
        if (q.metric === "passgame" && (payload.passPct ?? 0) >= q.threshold) increment = 1
      }
      if (type === "reaction") {
        if (q.metric === "session") increment = 1
      }

      if (increment === 0) return q // event didn't qualify for this quest

      const next = applyProgress(q, increment)

      // `rewarded` flag prevents double-awarding if recordProgress is called twice
      if (next.done && !q.rewarded) {
        await awardPoints(uid, next.xpReward)
        return { ...next, rewarded: true }
      }
      return next
    }))

    // Persist progress — writes only to the nested dailies field
    updateDoc(ref, { [`dailies.${dateKey}`]: { quests: updated, date: dateKey } })
    setQuests(updated)
  }

  return { quests, loading, recordProgress }
}
