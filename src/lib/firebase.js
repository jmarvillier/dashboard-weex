import { initializeApp }                             from 'firebase/app'
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore'

// 🔧 Remplace avec ta vraie config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBdJgv9gZamPkQbohhSyR_byr__wnE-CjY",
  authDomain: "dashboard-weex.firebaseapp.com",
  projectId: "dashboard-weex",
  storageBucket: "dashboard-weex.firebasestorage.app",
  messagingSenderId: "167218478733",
  appId: "1:167218478733:web:9c25811d2b7f87724facc4"
}

const app = initializeApp(firebaseConfig)

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
})
