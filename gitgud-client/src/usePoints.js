import { useState, useEffect } from "react"
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore"
import { db } from "./firebase"

const LEVEL_THRESHOLDS = [0, 100, 500, 1500, 4000, 10000]
// index = level-1, so LEVEL_THRESHOLDS[0] = Level 1 min XP, [1] = Level 2, etc.

export function getLevel(xp) {
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1
    else break
  }
  return level
}

export function getLevelProgress(xp) {
  const level = getLevel(xp)
  const isMax = level >= LEVEL_THRESHOLDS.length
  const currentFloor = LEVEL_THRESHOLDS[level - 1]
  const nextFloor = isMax ? null : LEVEL_THRESHOLDS[level]
  const pct = isMax ? 100 : Math.floor(((xp - currentFloor) / (nextFloor - currentFloor)) * 100)
  const xpToNext = isMax ? 0 : nextFloor - xp
  return { level, xp, pct, xpToNext, isMax }
}

export async function initUserDoc(uid, displayName, photoURL) {
  const ref = doc(db, "users", uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, { xp: 0, level: 1, displayName, photoURL }, { merge: true })
  } else {
    const d = snap.data(), updates = {}
    // migrate old points field to xp
    if (d.xp === undefined) updates.xp = d.points ?? 0
    if (d.level === undefined) updates.level = 1
    if (Object.keys(updates).length) await updateDoc(ref, updates)
  }
}

export async function awardPoints(uid, amount = 10) {
  const ref = doc(db, "users", uid)
  const data = (await getDoc(ref)).data() ?? {}
  const currentXp = data.xp ?? data.points ?? 0
  const newXp = currentXp + amount
  const newLevel = getLevel(newXp)
  await updateDoc(ref, { xp: newXp, level: newLevel })
}

export function usePoints(uid) {
  const [state, setState] = useState({ points: 0, xp: 0, level: 1, pct: 0, xpToNext: 100, loading: true })
  useEffect(() => {
    if (!uid) return
    return onSnapshot(doc(db, "users", uid), snap => {
      if (snap.exists()) {
        const d = snap.data()
        const xp = d.xp ?? d.points ?? 0
        const { level, pct, xpToNext, isMax } = getLevelProgress(xp)
        setState({ xp, points: xp, level, pct, xpToNext, isMax, loading: false })
      }
    })
  }, [uid])
  return state
}