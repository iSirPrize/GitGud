// auth.js — place in src/
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { app } from "./firebase";
import { sendPasswordResetEmail } from "firebase/auth";

export const sendPasswordReset = (email) =>
  sendPasswordResetEmail(auth, email);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const registerWithEmail = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const loginWithGoogle = () =>
  signInWithPopup(auth, googleProvider);

export const logout = () => signOut(auth);

export const onAuth = (cb) => onAuthStateChanged(auth, cb);
