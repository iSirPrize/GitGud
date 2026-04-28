import { useState, useEffect } from "react"
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore"
import { db } from "./firebase"

export async function initUserDoc(uid, displayName, photoURL) {
  const ref = doc(db, "users", uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, { points: 0, level: 1, displayName, photoURL }, { merge: true })
  } else {
    const d = snap.data(), updates = {}
    if (d.points === undefined) updates.points = 0
    if (d.level  === undefined) updates.level  = 1
    if (Object.keys(updates).length) await updateDoc(ref, updates)
  }
}

export async function awardPoints(uid, amount = 10) {
  const ref = doc(db, "users", uid)
  const { points = 0, level = 1 } = (await getDoc(ref)).data() ?? {}
  const total = points + amount
  await updateDoc(ref, total >= 100
    ? { points: total - 100, level: level + 1 }
    : { points: total })
}

export function usePoints(uid) {
  const [state, setState] = useState({ points: 0, level: 1, loading: true })
  useEffect(() => {
    if (!uid) return
    return onSnapshot(doc(db, "users", uid), snap => {
      if (snap.exists()) { const d = snap.data(); setState({ points: d.points ?? 0, level: d.level ?? 1, loading: false }) }
    })
  }, [uid])
  return state
}
