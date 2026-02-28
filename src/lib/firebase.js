/**
 * firebase.js
 * Initialisation Firebase + export de l'instance Firestore.
 *
 * 🔧 Remplace les valeurs ci-dessous par celles de ta Firebase Console :
 *   https://console.firebase.google.com → Ton projet → ⚙️ → Paramètres du projet
 *   → Tes applications → Ajouter une appli Web → SDK Config
 */

import { initializeApp }                            from 'firebase/app'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'

// ── 🔧 À REMPLACER ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBdJgv9gZamPkQbohhSyR_byr__wnE-CjY",
  authDomain: "dashboard-weex.firebaseapp.com",
  projectId: "dashboard-weex",
  storageBucket: "dashboard-weex.firebasestorage.app",
  messagingSenderId: "167218478733",
  appId: "1:167218478733:web:9c25811d2b7f87724facc4"
}
// ─────────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

// Active le cache offline → l'app fonctionne sans connexion,
// sync automatique au retour en ligne
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
})
