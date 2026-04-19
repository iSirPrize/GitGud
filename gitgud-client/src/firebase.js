// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCb8jnHOpu2pt5IBc1nAl6dScdoTBqIfeg",
  authDomain: "gitgud-4b9f2.firebaseapp.com",
  projectId: "gitgud-4b9f2",
  storageBucket: "gitgud-4b9f2.firebasestorage.app",
  messagingSenderId: "279996418674",
  appId: "1:279996418674:web:aa2bd07b840c14608590eb"
};


export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
