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
  apiKey            : 'REMPLACE_PAR_TON_API_KEY',
  authDomain        : 'REMPLACE_PAR_TON_AUTH_DOMAIN',
  projectId         : 'REMPLACE_PAR_TON_PROJECT_ID',
  storageBucket     : 'REMPLACE_PAR_TON_STORAGE_BUCKET',
  messagingSenderId : 'REMPLACE_PAR_TON_MESSAGING_SENDER_ID',
  appId             : 'REMPLACE_PAR_TON_APP_ID',
}
// ─────────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

// Active le cache offline → l'app fonctionne sans connexion,
// sync automatique au retour en ligne
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firebase persistence : plusieurs onglets ouverts — désactivé.')
  } else if (err.code === 'unimplemented') {
    console.warn('Firebase persistence : navigateur non supporté.')
  }
})
