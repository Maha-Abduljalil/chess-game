import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAKWV09cm7aLSew62cuxIdOJLg6qAJtN68",
  authDomain: "chess-game-cc.firebaseapp.com",
  projectId: "chess-game-cc",
  storageBucket: "chess-game-cc.firebasestorage.app",
  messagingSenderId: "583086658119",
  appId: "1:583086658119:web:c648951c5fcd294e805762",
  measurementId: "G-WGGYG1SWQ7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  return result.user;
}