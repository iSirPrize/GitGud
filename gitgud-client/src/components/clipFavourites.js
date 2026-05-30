// src/clipFavourites.js
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const clipFavDoc = (uid, clipId) =>
  doc(db, "users", uid, "favourites", clipId);

export async function addClipFavorite(uid, clip) {
  return setDoc(clipFavDoc(uid, clip.id), {
    id: clip.id,
    title: clip.title || "User Quiz",
    thumbnail: clip.thumbnail || "",
    videoPath: clip.videoPath || clip.route || `/quiz/${clip.id}`,
    game: clip.game || "",
    createdAt: serverTimestamp(),
  });
}

export async function removeClipFavorite(uid, clipId) {
  return deleteDoc(clipFavDoc(uid, clipId));
}

export async function clipIsFavorited(uid, clipId) {
  const snap = await getDoc(clipFavDoc(uid, clipId));
  return snap.exists();
}

export function subscribeClipFavourites(uid, onChange) {
  const col = collection(db, "users", uid, "favourites")
  return onSnapshot(col, (snap) =>
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}
