import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDkUfA5Z3CTVEeC_76hOI849CTn7rVrn9M",
  authDomain: "coaching-ops-31b54.firebaseapp.com",
  projectId: "coaching-ops-31b54",
  storageBucket: "coaching-ops-31b54.firebasestorage.app",
  messagingSenderId: "491426086053",
  appId: "1:491426086053:web:6357bce7ea7c75373ba14c",
  measurementId: "G-9TVRTMGS0G",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
