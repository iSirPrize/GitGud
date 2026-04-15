<<<<<<< HEAD
// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
=======
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
>>>>>>> bb64d7f (Added comment section (CSS + JSX), updated QuizCarousel import, edited firebase.js, added .env)

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

<<<<<<< HEAD
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
=======
export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
>>>>>>> bb64d7f (Added comment section (CSS + JSX), updated QuizCarousel import, edited firebase.js, added .env)
