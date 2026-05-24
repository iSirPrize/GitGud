// useDailies.js
// Central logic for the daily quests system.
// Exports pure functions (tested by dailies.test.js) and a React hook.
// Firestore: writes only to users/{uid}/dailies/{date} — no existing fields touched.

import { useState, useEffect } from "react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "./firebase"
import { awardPoints } from "./usePoints"

// ─── Quest Pool (10 quests) ───────────────────────────────────────────────────
// type   : which activity feeds progress ("aim" | "quiz" | "reaction")
// metric : what stat to check for aim quests ("accuracy" | "session")
// required: how many times the condition must be met
// xpReward: XP awarded on completion (via existing awardPoints())

export const QUEST_POOL = [
  { id: "aim_acc_70",   type: "aim",      metric: "accuracy", threshold: 70, label: "Get ≥70% accuracy in Aim Trainer",          required: 1, xpReward: 30  },
  { id: "aim_acc_80",   type: "aim",      metric: "accuracy", threshold: 80, label: "Get ≥80% accuracy in Aim Trainer",          required: 1, xpReward: 50  },
  { id: "aim_sess_1",   type: "aim",      metric: "session",  threshold: 0,  label: "Complete an Aim Trainer session",           required: 1, xpReward: 20  },
  { id: "aim_sess_2",   type: "aim",      metric: "session",  threshold: 0,  label: "Complete 2 Aim Trainer sessions",           required: 2, xpReward: 40  },
  { id: "quiz_q_3",     type: "quiz",     metric: "correct",  threshold: 0,  label: "Answer 3 quiz questions correctly",         required: 3, xpReward: 30  },
  { id: "quiz_q_5",     type: "quiz",     metric: "correct",  threshold: 0,  label: "Answer 5 quiz questions correctly",         required: 5, xpReward: 50  },
  { id: "quiz_pass_60", type: "quiz",     metric: "passgame", threshold: 60, label: "Score ≥60% on a full quiz",                 required: 1, xpReward: 40  },
  { id: "quiz_pass_80", type: "quiz",     metric: "passgame", threshold: 80, label: "Score ≥80% on a full quiz",                 required: 1, xpReward: 60  },
  { id: "react_sess_1", type: "reaction", metric: "session",  threshold: 0,  label: "Complete a Reaction Trainer session",       required: 1, xpReward: 20  },
  { id: "react_sess_2", type: "reaction", metric: "session",  threshold: 0,  label: "Complete 2 Reaction Trainer sessions",      required: 2, xpReward: 40  },
]

// ─── Pure: deterministic date-seeded pick ────────────────────────────────────
// Hashes the date string to an integer seed, then uses it to shuffle a copy
// of the pool and take the first 3. Same date always yields same 3 quests.

function hashDate(dateStr) {
  // Simple djb2-style hash over the characters of the date string
  let h = 5381
  for (let i = 0; i < dateStr.length; i++) {
    h = (h * 33) ^ dateStr.charCodeAt(i)
  }
  return Math.abs(h)
}

export function pickDailyQuests(dateStr = todayKey()) {
  const seed  = hashDate(dateStr)
  const pool  = [...QUEST_POOL]

  // Fisher-Yates shuffle driven by the seed so it's reproducible
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (seed * (i + 7919)) % (i + 1) // prime multiple keeps spread wide
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  return pool.slice(0, 3)
}

// ─── Pure: progress helpers ───────────────────────────────────────────────────

// Returns true if the quest's progress has reached its required count
export function isQuestComplete(quest) {
  return quest.progress >= quest.required
}

// Returns xpReward for a complete quest, 0 for an incomplete one
export function calcQuestXP(quest) {
  return isQuestComplete(quest) ? quest.xpReward : 0
}

// Returns a new quest object with progress incremented by `amount`.
// Caps at required, marks done, and ignores already-done quests.
export function applyProgress(quest, amount) {
  if (quest.done) return quest                             // guard: already done
  const newProgress = Math.min(quest.progress + amount, quest.required)
  return { ...quest, progress: newProgress, done: newProgress >= quest.required }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns today's date as "YYYY-MM-DD" in local time — used as Firestore doc id
export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ─── Hook: useDailies ─────────────────────────────────────────────────────────
// Loads today's quests from Firestore (or creates them if first visit today).
// Exposes `recordProgress` for activity pages to call after a game ends.
// Firestore path: users/{uid}/dailies/{YYYY-MM-DD}
// No existing user document fields are read or written.

export function useDailies(uid) {
  const [quests, setQuests]   = useState([])
  const [loading, setLoading] = useState(true)
  const dateKey = todayKey()

  // Load or initialise today's daily document
  useEffect(() => {
    if (!uid) return
    const ref = doc(db, "users", uid, "dailies", dateKey)

    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        // Already initialised today — load saved progress
        setQuests(snap.data().quests)
      } else {
        // First visit today — pick 3 quests with zero progress and save them
        const fresh = pickDailyQuests(dateKey).map((q) => ({
          ...q,
          progress: 0,
          done:     false,
          rewarded: false,   // tracks whether XP has been awarded (prevent double-award)
        }))
        setDoc(ref, { quests: fresh, date: dateKey })  // new subcollection doc — no merge needed
        setQuests(fresh)
      }
      setLoading(false)
    }).catch((err) => {
      console.error("useDailies: failed to load daily quests", err)
      setLoading(false)
    })
  }, [uid, dateKey])

  // Called by activity pages when a relevant game event occurs.
  // type    : "aim" | "quiz" | "reaction"
  // payload : { accuracy?, correct?, passPct?, session? }
  const recordProgress = async (type, payload) => {
    if (!uid || quests.length === 0) return

    const ref = doc(db, "users", uid, "dailies", dateKey)

    // Build updated quests array — only update quests matching the activity type
    const updated = await Promise.all(quests.map(async (q) => {
      if (q.type !== type || q.done) return q   // skip unrelated or finished quests

      let increment = 0

      if (type === "aim") {
        if (q.metric === "session") increment = 1
        if (q.metric === "accuracy" && payload.accuracy >= q.threshold) increment = 1
      }

      if (type === "quiz") {
        if (q.metric === "correct")  increment = payload.correct  ?? 0
        if (q.metric === "passgame" && (payload.passPct ?? 0) >= q.threshold) increment = 1
      }

      if (type === "reaction") {
        if (q.metric === "session") increment = 1
      }

      if (increment === 0) return q

      const next = applyProgress(q, increment)

      // Award XP exactly once when the quest completes
      if (next.done && !q.rewarded) {
        await awardPoints(uid, next.xpReward)
        return { ...next, rewarded: true }
      }

      return next
    }))

    // Persist updated progress to the dailies subcollection doc only
    setDoc(ref, { quests: updated, date: dateKey })
    setQuests(updated)
  }

  return { quests, loading, recordProgress }
}
