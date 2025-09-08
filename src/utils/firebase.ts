import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
apiKey: "AIzaSyA39002uqowAS55OqNkg5sUAy0rQ2v_d8g",
  authDomain: "coding-website-44c1f.firebaseapp.com",
  projectId: "coding-website-44c1f",
  storageBucket: "coding-website-44c1f.firebasestorage.app",
  messagingSenderId: "643635482494",
  appId: "1:643635482494:web:d127e11dfbd08e79762d2f",
  measurementId: "G-02LVF6BNK8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
